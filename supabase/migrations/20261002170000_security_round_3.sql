-- Security review round 3 (2026-10-02).
--
-- 1) Admin referral codes were readable by anyone ("Anyone can validate active referral codes").
--    redeem_referral_code is SECURITY DEFINER and validates the code itself, so the public read goes.
-- 2) The mule-risk scorer and scan were executable by anyone, including logged out: they return
--    flagged borrowers' usernames, payout destinations and fraud reasons, and running the scan marks
--    them alerted so the team never hears. The scorer is now admins (and the server) only; the scan
--    is server only.
-- 3) The wallet lock (20260816090000) isn't on the live users table, and it only checked the NEW
--    role, so flipping user_role to 'lender' skipped it. Reinstalled: a borrower's wallet can't be
--    swapped or cleared while they have an unpaid funded loan OR a live request (a lender pays the
--    wallet saved on the request), whatever their role.
-- 4) users.is_test and loans.is_test are server/admin only (admin_set_entity_test), so nobody can hide
--    their own account or loans from fraud scans and team feeds.
-- 5) New loan requests: amounts in whole cents (a lender's wallet sends 2-decimal amounts, so a
--    sub-cent request could never be funded), and is_test starts false.

-- 1) Referral codes: no public read.
drop policy if exists "Anyone can validate active referral codes" on public.referral_codes;

-- 2) Mule risk: the real scorer moves to app_private; the public name is an admin-checked wrapper.
alter function public.score_borrower_mule_risk(integer, integer) rename to score_borrower_mule_risk_impl;
alter function public.score_borrower_mule_risk_impl(integer, integer) set schema app_private;
revoke all on function app_private.score_borrower_mule_risk_impl(integer, integer) from public, anon, authenticated;

create or replace function public.score_borrower_mule_risk(top_n integer default 50, fast_offramp_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
     and not app_private.is_moodeng_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return app_private.score_borrower_mule_risk_impl(top_n, fast_offramp_hours);
end;
$$;

revoke all on function public.score_borrower_mule_risk(integer, integer) from public, anon;
grant execute on function public.score_borrower_mule_risk(integer, integer) to authenticated, service_role;

create or replace function public.scan_mule_risk(min_score integer default 60, top_n integer default 200, fast_offramp_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  new_signals jsonb := '[]'::jsonb;
  rec jsonb;
  uid text;
  sev text;
begin
  for rec in
    select value from jsonb_array_elements(app_private.score_borrower_mule_risk_impl(top_n, fast_offramp_hours))
  loop
    if (rec->>'score')::int < min_score then continue; end if;
    uid := rec->>'user_id';
    -- Alert once per borrower — a rising score doesn't re-fire (no alert fatigue).
    if exists (select 1 from public.fraud_signal_alerts a
               where a.signal_type = 'high_mule_risk' and a.subject_key = uid) then
      continue;
    end if;
    sev := case when (rec->>'score')::int >= 80 then 'critical' else 'warning' end;
    insert into public.fraud_signal_alerts (signal_type, subject_key, details)
    values ('high_mule_risk', uid,
            jsonb_build_object('score', rec->'score', 'reasons', rec->'reasons',
                               'username', rec->'username', 'destinations', rec->'destinations'));
    new_signals := new_signals || jsonb_build_object(
      'type', 'high_mule_risk', 'severity', sev,
      'user_id', uid, 'username', rec->>'username',
      'score', (rec->>'score')::int,
      'details', jsonb_build_object('reasons', rec->'reasons'));
  end loop;
  return jsonb_build_object('signals', new_signals);
end;
$$;

revoke all on function public.scan_mule_risk(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.scan_mule_risk(integer, integer, integer) to service_role;

-- 3) Wallet lock, reinstalled and role-independent.
create or replace function public.borrower_has_active_loan(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.loans
    where borrower_user_id = p_user
      and (
        (loan_status = 'Lent' and repayment_status::text <> 'Paid')
        -- A live request: a lender pays the wallet saved on it (REQUEST_EXPIRATION_DAYS = 7).
        or (loan_status = 'Requested' and created_at > now() - interval '7 days')
      )
  );
$$;

revoke all on function public.borrower_has_active_loan(uuid) from public;
grant execute on function public.borrower_has_active_loan(uuid) to authenticated, anon;

create or replace function public.lock_borrower_wallet_with_active_loan()
returns trigger as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- Any role: flipping user_role to 'lender' for one write must not unlock the wallet.
  if old.wallet_address is not null
     and new.wallet_address is distinct from old.wallet_address
     and lower(coalesce(new.wallet_address, '')) <> lower(old.wallet_address)
     and public.borrower_has_active_loan(new.id)
  then
    raise exception 'wallet is locked while you have an open loan request or an unpaid loan: cancel the request or repay the loan before changing your wallet'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

drop trigger if exists trg_lock_borrower_wallet_with_active_loan on public.users;
create trigger trg_lock_borrower_wallet_with_active_loan
  before update on public.users
  for each row execute function public.lock_borrower_wallet_with_active_loan();

-- 4) is_test is server/admin only.
create or replace function app_private.keep_is_test_server_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_test := false;
    elsif new.is_test is distinct from old.is_test then
      new.is_test := old.is_test;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_keep_user_is_test on public.users;
create trigger trg_keep_user_is_test
  before insert or update on public.users
  for each row execute function app_private.keep_is_test_server_only();

drop trigger if exists trg_keep_loan_is_test on public.loans;
create trigger trg_keep_loan_is_test
  before insert or update on public.loans
  for each row execute function app_private.keep_is_test_server_only();

-- 5) New loan requests in whole cents.
create or replace function app_private.enforce_new_loan_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.total_repayment_amount is null or new.total_repayment_amount < new.loan_amount then
    raise exception 'loans: the repayment total can''t be less than the amount borrowed';
  end if;
  if new.loan_amount <> round(new.loan_amount, 2) or new.total_repayment_amount <> round(new.total_repayment_amount, 2) then
    raise exception 'loans: amounts must be in whole cents';
  end if;
  new.credit_limit_at_repayment := null;
  new.refunded_at := null;
  new.refund_reason := null;
  new.refunded_by := null;
  new.refund_hash := null;
  new.offplatform_settlement_note := null;
  return new;
end;
$$;

-- 6) record_loan_payment spends the hashes the edge function says belong to THIS payment (a Base
--    Account payment's userOp hash only; a plain tx's hash plus the sender's userOps inside it) and
--    records the real tx hash on the loan separately. Spending the shared bundle tx hash rejected a
--    second person's payment that happened to land in the same transaction. It also reports how much
--    of a repayment was more than was left, so the team can send it back.
-- The old (…, text, text, …) signature is dropped by 20261002170100, after the new confirm-loan-payment is live.

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
    update public.loans
       set hash = coalesce(hash, '{}'::text[]) || v_record,
           repaid_amount = case when v_full then total_repayment_amount else v_new_repaid end,
           repayment_status = (case when v_full then 'Paid' else 'Partial' end)::public.repayment_status,
           repaid_at = case when v_full then now() else repaid_at end
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
