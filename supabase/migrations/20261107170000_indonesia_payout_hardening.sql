-- Indonesia track: payout hardening (review fixes on 20261107140000–160000; none of those were applied
-- anywhere yet, this file goes on top of them).
--
--   1. A loan that is being paid out can't be deleted (by the borrower, admin-loan-request-removed,
--      admin-ban-user …) and its payout record can't be wiped: id_manual_payouts.loan_id is now
--      ON DELETE RESTRICT, and BEFORE DELETE guards on loans + id_manual_payouts refuse while a payout
--      row is 'paying' / 'found', was marked sent, has an Openfort tx, a BNB Chain tx, or is an automatic
--      attempt nobody has checked on chain yet. A plain 'waiting' row is deleted together with its loan.
--      While a payout is claimed / marked sent the loan carries on_hold_reason = 'id_payout_in_progress'
--      (on_hold_since stays null, so the request board and the no-show UI are unchanged).
--   2. Base funding refuses Indonesia loans: record_loan_payment('fund') returns
--      'id_loan_paid_by_moodeng' for market 'ID' (they are paid to Walt from admin).
--   3/5. chain_checked_at / chain_scanned_to_block: a failed (or stuck) automatic payout is looked for on
--      BNB Chain (payout wallet → Walt) before any hand payment is allowed (_shared/idManualFunding.ts).
--   6. One BNB Chain tx can carry several transfers: uniqueness is (bsc_tx_hash, log_index).
--   7. apply_idr_peg_on_repayment: with no rate under 36h, use the latest stored rate of any age, and
--      fx_rate_at_request only when fx_rates is empty.
--   9. loans.usd_total_at_request: the USD total an ID loan was priced at when requested (server-set,
--      client-proof), for the BitRepo report (total_repayment_amount floats with the rupiah).

-- ── 1. payouts survive loan deletion ───────────────────────────────────────────────────────────
alter table public.id_manual_payouts drop constraint if exists id_manual_payouts_loan_id_fkey;
alter table public.id_manual_payouts
  add constraint id_manual_payouts_loan_id_fkey foreign key (loan_id) references public.loans(id) on delete restrict;

-- 3/5: set when BNB Chain was searched for an automatic payout (payout wallet → Walt) and nothing was
-- there; until then a failed automatic payout can't be paid by hand. chain_scanned_to_block = how far
-- that search got (it resumes there).
alter table public.id_manual_payouts
  add column if not exists chain_checked_at timestamptz,
  add column if not exists chain_scanned_to_block bigint,
  -- 6: the Transfer's log index inside bsc_tx_hash.
  add column if not exists log_index integer;

-- 6: (tx, log) is what can be used only once.
alter table public.id_manual_payouts drop constraint if exists id_manual_payouts_bsc_tx_hash_key;
alter table public.id_manual_payouts drop constraint if exists id_manual_payouts_bsc_tx_log_key;
alter table public.id_manual_payouts add constraint id_manual_payouts_bsc_tx_log_key unique (bsc_tx_hash, log_index);
alter table public.id_manual_payouts drop constraint if exists id_manual_payouts_log_index_check;
alter table public.id_manual_payouts
  add constraint id_manual_payouts_log_index_check check (bsc_tx_hash is null or log_index is not null);

-- True when money may have moved (or is moving) for this payout row.
create or replace function app_private.id_payout_is_locked(p public.id_manual_payouts)
returns boolean language sql immutable set search_path = '' as $$
  select p.status in ('paying', 'found')
      or p.marked_sent_at is not null
      or p.openfort_tx_id is not null
      or p.bsc_tx_hash is not null
      or (p.method = 'auto' and p.paid_attempt_at is not null and p.chain_checked_at is null);
$$;

create or replace function app_private.guard_id_payout_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if app_private.id_payout_is_locked(old) then
    raise exception 'loans: this loan is being paid out — it can''t be removed (pinjaman ini sedang dicairkan — tidak bisa dihapus)';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_guard_id_payout_delete on public.id_manual_payouts;
create trigger trg_guard_id_payout_delete
  before delete on public.id_manual_payouts
  for each row execute function app_private.guard_id_payout_delete();

create or replace function app_private.guard_loan_delete_during_id_payout()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.id_manual_payouts p where p.loan_id = old.id and app_private.id_payout_is_locked(p)) then
    raise exception 'loans: this loan is being paid out — it can''t be removed (pinjaman ini sedang dicairkan — tidak bisa dihapus)';
  end if;
  -- Nothing sent: the 'waiting' row goes with the loan (the FK is RESTRICT now).
  delete from public.id_manual_payouts where loan_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_guard_loan_delete_during_id_payout on public.loans;
create trigger trg_guard_loan_delete_during_id_payout
  before delete on public.loans
  for each row execute function app_private.guard_loan_delete_during_id_payout();

-- Claimed by the payout wallet or marked sent by an admin → the loan says so (the borrower's card hides
-- Delete for it). Cleared when the loan is funded (recordFunding sets on_hold_reason null).
create or replace function app_private.stamp_loan_id_payout_in_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.status = 'paying' or new.marked_sent_at is not null)
     and (tg_op = 'INSERT' or old.status is distinct from new.status or old.marked_sent_at is distinct from new.marked_sent_at) then
    update public.loans
       set on_hold_reason = 'id_payout_in_progress'
     where id = new.loan_id
       and loan_status::text = 'Requested'
       and on_hold_since is null
       and on_hold_reason is distinct from 'id_payout_in_progress';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_stamp_loan_id_payout on public.id_manual_payouts;
create trigger trg_stamp_loan_id_payout
  after insert or update of status, marked_sent_at on public.id_manual_payouts
  for each row execute function app_private.stamp_loan_id_payout_in_progress();

-- ── 2. Base funding never funds an Indonesia loan ──────────────────────────────────────────────
-- Same function as 20261003120000_record_limit_with_repayment.sql (latest in the repo), one check added
-- to the 'fund' branch. NOTE: diff against the live body before applying.
create or replace function public.record_loan_payment(
  p_loan_id uuid,
  p_action text,
  p_caller uuid,
  p_spend_hashes text[],
  p_record_hash text,
  p_amount_micros bigint,
  p_from text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans;
  v_record text := lower(p_record_hash);
  v_hash text;
  v_paid numeric := p_amount_micros / 1000000.0;
  v_remaining numeric;
  v_new_repaid numeric;
  v_full boolean;
  v_overpaid_micros bigint := 0;
  v_limit integer;
begin
  if p_spend_hashes is null or cardinality(p_spend_hashes) = 0 then
    return jsonb_build_object('error', 'no_hash');
  end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  if p_action = 'fund' then
    if v_loan.loan_status::text <> 'Requested' or v_loan.lender_user_id is not null then
      return jsonb_build_object('error', 'not_open');
    end if;
    -- Indonesia loans are paid to the borrower's Walt from admin (payout wallet / Binance TH), never
    -- funded on Base: that would pay the loan twice.
    if v_loan.market = 'ID' then
      return jsonb_build_object('error', 'id_loan_paid_by_moodeng', 'message', 'Indonesia loans are paid to Walt from admin');
    end if;
  elsif p_action = 'repay' then
    if v_loan.loan_status::text <> 'Lent' or coalesce(v_loan.repayment_status::text, '') = 'Paid' then
      return jsonb_build_object('error', 'not_awaiting_repayment');
    end if;
  elsif p_action = 'return-interest' then
    if coalesce(v_loan.repayment_status::text, '') <> 'Paid' or v_loan.interest_returned_at is not null then
      return jsonb_build_object('error', 'interest_not_returnable');
    end if;
  else
    return jsonb_build_object('error', 'bad_action');
  end if;

  begin
    foreach v_hash in array (select array_agg(distinct lower(h)) from unnest(p_spend_hashes) as h) loop
      insert into public.used_payment_hashes (hash, loan_id) values (v_hash, p_loan_id);
    end loop;
  exception when unique_violation then
    return jsonb_build_object('error', 'hash_used');
  end;

  if p_action = 'fund' then
    update public.loans
       set hash = coalesce(hash, '{}'::text[]) || v_record,
           lender_user_id = p_caller,
           lender_wallet = lower(p_from),
           loan_status = 'Lent'::public.loan_status,
           funded_at = now(),
           on_hold_since = null,
           on_hold_reason = null
     where id = p_loan_id
     returning * into v_loan;
  elsif p_action = 'repay' then
    v_remaining := greatest(v_loan.total_repayment_amount - coalesce(v_loan.repaid_amount, 0), 0);
    if v_paid > v_remaining then
      v_overpaid_micros := round((v_paid - v_remaining) * 1000000);
    end if;
    v_new_repaid := least(coalesce(v_loan.repaid_amount, 0) + v_paid, v_loan.total_repayment_amount);
    v_full := v_new_repaid >= v_loan.total_repayment_amount - 0.005;
    if v_full and v_loan.credit_limit_at_repayment is null then
      select case when u.is_world_id::text = 'ACTIVE' or u.is_didit::text = 'ACTIVE'
                  then least(greatest(coalesce(u.cs, 0), 15), 140) end
        into v_limit
        from public.users as u
       where u.id = v_loan.borrower_user_id;
    end if;
    update public.loans
       set hash = coalesce(hash, '{}'::text[]) || v_record,
           repaid_amount = case when v_full then total_repayment_amount else v_new_repaid end,
           repayment_status = (case when v_full then 'Paid' else 'Partial' end)::public.repayment_status,
           repaid_at = case when v_full then now() else repaid_at end,
           credit_limit_at_repayment = coalesce(credit_limit_at_repayment, v_limit)
     where id = p_loan_id
     returning * into v_loan;
  else
    update public.loans
       set interest_returned_at = now(),
           interest_return_hash = v_record
     where id = p_loan_id
     returning * into v_loan;
  end if;

  return jsonb_build_object('loan', to_jsonb(v_loan), 'overpaid_micros', v_overpaid_micros);
end;
$$;

revoke all on function public.record_loan_payment(uuid, text, uuid, text[], text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_loan_payment(uuid, text, uuid, text[], text, bigint, text) to service_role;

-- ── 7. peg fallback rate ───────────────────────────────────────────────────────────────────────
-- The latest stored USD/IDR rate whatever its age (what total_repayment_amount was last priced at).
create or replace function public.latest_usd_idr_any_age()
returns numeric language sql stable security definer set search_path = '' as $$
  select r.rate from public.fx_rates r where r.pair = 'USD/IDR' order by r.fetched_at desc limit 1;
$$;
revoke execute on function public.latest_usd_idr_any_age() from public, anon, authenticated;
grant execute on function public.latest_usd_idr_any_age() to service_role;

-- Same as 20261107160000 except the rate: fresh → latest of any age → fx_rate_at_request (only when
-- fx_rates is empty).
create or replace function app_private.apply_idr_peg_on_repayment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_rate numeric;
  v_left numeric;
  v_limit integer;
begin
  if new.repay_idr is null then
    return new;
  end if;
  if coalesce(new.repaid_amount, 0) <= coalesce(old.repaid_amount, 0) then
    return new;
  end if;
  if coalesce(old.repayment_status::text, '') = 'Paid' then
    return new;
  end if;

  v_rate := coalesce(public.current_usd_idr(), public.latest_usd_idr_any_age(), new.fx_rate_at_request);
  if v_rate is null or v_rate <= 0 then
    return new;
  end if;

  if new.repaid_idr is not distinct from old.repaid_idr then
    new.repaid_idr := round(coalesce(old.repaid_idr, 0) + (new.repaid_amount - coalesce(old.repaid_amount, 0)) * v_rate, 2);
  end if;

  if coalesce(new.repayment_status::text, '') = 'Paid' then
    return new;
  end if;

  v_left := greatest(0, new.repay_idr - new.repaid_idr);
  if v_left < 1000 then
    new.total_repayment_amount := new.repaid_amount;
    new.repayment_status := 'Paid'::public.repayment_status;
    new.repaid_at := coalesce(new.repaid_at, now());
    if new.credit_limit_at_repayment is null then
      select case when u.is_world_id::text = 'ACTIVE' or u.is_didit::text = 'ACTIVE'
                  then least(greatest(coalesce(u.cs, 0), 15), 140) end
        into v_limit
        from public.users as u
       where u.id = new.borrower_user_id;
      new.credit_limit_at_repayment := v_limit;
    end if;
  else
    new.total_repayment_amount := round(new.repaid_amount + v_left / v_rate, 2);
  end if;
  return new;
end;
$$;
-- reprice_id_loans is unchanged on purpose: without a fresh rate it leaves every total where it was
-- last priced (= the latest stored rate), which is the same fallback.

-- ── 9. the USD total at request, for the BitRepo report ────────────────────────────────────────
alter table public.loans add column if not exists usd_total_at_request numeric;
comment on column public.loans.usd_total_at_request is
  'Indonesia track: total_repayment_amount (USD) as priced when the request was made (repay_idr ÷ fx_rate_at_request). Server-set; the live total floats with the rupiah.';

create or replace function app_private.enforce_loan_idr_columns_server_only()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.repay_idr is distinct from old.repay_idr
     or new.repaid_idr is distinct from old.repaid_idr
     or new.fx_rate_at_request is distinct from old.fx_rate_at_request
     or new.fx_alerted_at is distinct from old.fx_alerted_at
     or new.usd_total_at_request is distinct from old.usd_total_at_request
  then
    raise exception 'loans: the rupiah terms can only be changed by the server';
  end if;
  return new;
end;
$$;

-- Same function as 20261107160000 (full body), usd_total_at_request added.
create or replace function app_private.enforce_new_loan_terms()
returns trigger language plpgsql set search_path to '' as $function$
declare
  v_market text;
  v_access text;
  v_didit text;
  v_walt text;
  v_rules jsonb;
  v_max_days int;
  v_rate numeric;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select u.market, u.loan_access_status, u.is_didit, u.walt_address into v_market, v_access, v_didit, v_walt
  from public.users u where u.id = new.borrower_user_id;

  new.repaid_idr := 0;
  new.fx_alerted_at := null;
  new.usd_total_at_request := null;
  if v_market = 'ID' then
    if new.repay_idr is null then
      raise exception 'loans: choose how many rupiah you will repay';
    end if;
    if new.repay_idr <= 0 or new.repay_idr <> trunc(new.repay_idr) or mod(new.repay_idr, 500) <> 0 then
      raise exception 'loans: the rupiah repayment must be whole rupiah in steps of Rp 500';
    end if;
    v_rate := public.current_usd_idr();
    if v_rate is null then
      raise exception 'loans: no exchange rate right now, try again later';
    end if;
    new.fx_rate_at_request := v_rate;
    new.total_repayment_amount := round(new.repay_idr / v_rate, 2);
    new.usd_total_at_request := new.total_repayment_amount;
  else
    new.repay_idr := null;
    new.fx_rate_at_request := null;
  end if;

  if new.total_repayment_amount is null or new.total_repayment_amount < new.loan_amount then
    raise exception 'loans: the repayment total can''t be less than the amount borrowed';
  end if;
  if new.total_repayment_amount < new.loan_amount + 1 then
    raise exception 'loans: the repayment must be at least $1 more than the amount borrowed';
  end if;
  if new.loan_amount <> round(new.loan_amount, 2) or new.total_repayment_amount <> round(new.total_repayment_amount, 2) then
    raise exception 'loans: amounts must be in whole cents';
  end if;
  if new.due_date is null or new.due_date < now() - interval '2 days' or new.due_date > now() + interval '122 days' then
    raise exception 'loans: the repayment date must be between today and 120 days from now';
  end if;

  if v_market = 'ID' then
    v_rules := public.get_id_loan_rules();
    v_max_days := (v_rules ->> 'maxTermDays')::int;
    if v_access is distinct from 'approved' or v_didit is distinct from 'ACTIVE' or v_walt is null then
      raise exception 'loans: finish your Indonesia onboarding and call before requesting a loan';
    end if;
    if not exists (select 1 from jsonb_array_elements_text(v_rules -> 'amounts') a where a::numeric = new.loan_amount) then
      raise exception 'loans: Indonesia loans can only be %', (select string_agg('$' || a, ' or ') from jsonb_array_elements_text(v_rules -> 'amounts') a);
    end if;
    if new.due_date > now() + make_interval(days => v_max_days + 1) then
      raise exception 'loans: Indonesia loans must be repaid within % days', v_max_days;
    end if;
    if new.total_repayment_amount > new.loan_amount * 1.5 then
      raise exception 'loans: the repayment can be at most 1.5× the amount borrowed';
    end if;
  end if;

  new.credit_limit_at_repayment := null;
  new.refunded_at := null;
  new.refund_reason := null;
  new.refunded_by := null;
  new.refund_hash := null;
  new.offplatform_settlement_note := null;
  return new;
end;
$function$;

-- The lender page (moodeng.app/creditline) reads loans through this RPC: same function as
-- 20261014090000_credit_line_password_case_insensitive.sql with 'usd_total_at_request' added.
-- NOTE: diff against the live body before applying.
create or replace function public.credit_line_lender_report(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_facility_id uuid;
  v_recent_failures int;
  v_result jsonb;
begin
  select count(*) into v_recent_failures
  from public.credit_facility_access_attempts
  where not ok and attempted_at > now() - interval '15 minutes';
  if v_recent_failures >= 10 then
    return jsonb_build_object('error', 'locked');
  end if;

  select a.facility_id into v_facility_id
  from public.credit_facility_access a
  where p_password is not null and length(trim(p_password)) between 1 and 200
    and a.password_hash = extensions.crypt(lower(trim(p_password)), a.password_hash)
  limit 1;

  insert into public.credit_facility_access_attempts (ok) values (v_facility_id is not null);
  if v_facility_id is null then
    return jsonb_build_object('error', 'wrong_password');
  end if;

  select jsonb_build_object(
    'facility', (
      select to_jsonb(f) - 'notes' - 'created_at'
      from public.credit_facilities f where f.id = v_facility_id
    ),
    'loans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'tracking_id', l.tracking_id,
        'borrower_user_id', l.borrower_user_id,
        'funded_at', l.funded_at,
        'due_date', l.due_date,
        'loan_amount', l.loan_amount,
        'total_repayment_amount', l.total_repayment_amount,
        'usd_total_at_request', l.usd_total_at_request,
        'repaid_amount', l.repaid_amount,
        'repaid_at', l.repaid_at,
        'repayment_status', l.repayment_status,
        'hash', to_jsonb(l.hash),
        'reason', l.reason,
        'rationale', c.rationale,
        'borrower_wallet', l.borrower_wallet,
        'borrower', jsonb_build_object(
          'username', u.username,
          'kyc_passed', (u.is_didit = 'ACTIVE' or u.is_world_id = 'ACTIVE'),
          'kyc_provider', case when u.is_didit = 'ACTIVE' then 'Didit' when u.is_world_id = 'ACTIVE' then 'World ID' end,
          'kyc_date', u.didit_submitted_at,
          'liveness', (u.liveness_status = 'APPROVED'),
          'facebook_verified', (u.messenger_verified_at is not null),
          'video_call_attended', (u.video_call_outcome = 'attended')
        )
      ) order by l.funded_at)
      from public.credit_facility_loans c
      join public.loans l on l.id = c.loan_id
      left join public.users u on u.id = l.borrower_user_id
      where c.facility_id = v_facility_id
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(to_jsonb(g) - 'facility_id' - 'created_at' order by g.occurred_at)
      from public.credit_facility_ledger g where g.facility_id = v_facility_id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.credit_line_lender_report(text) from public;
grant execute on function public.credit_line_lender_report(text) to anon, authenticated;

-- ── 8. rate sanity alert throttle ──────────────────────────────────────────────────────────────
insert into public.telegram_bot_settings (key, value, description) values
  ('fx_rate_alerted_at', '', 'Rupiah peg: last "USD/IDR sources disagree / look wrong" team alert (at most once per 6 h).')
on conflict (key) do nothing;
