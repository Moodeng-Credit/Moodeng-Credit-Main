-- Indonesia track: the rupiah peg.
--
--   Indonesian borrowers owe a FIXED number of rupiah. Moodeng still lends USD ($5/$10 USDC —
--   loans.loan_amount stays USD, that's what is sent) and is repaid in USDC; the USD still owed
--   floats with the USD/IDR rate and Moodeng carries the small FX swing.
--
--     loans.repay_idr            the fixed rupiah total the borrower promised (client sends it on insert)
--     loans.fx_rate_at_request   USD/IDR when the request was made (server-set)
--     loans.repaid_idr           rupiah paid so far: each USDC repayment × that day's rate (server-set)
--     loans.fx_alerted_at        the team was told the rate moved > 5% on this loan (server-set)
--     loans.total_repayment_amount  kept current by the server: repaid_amount + rupiah left ÷ today's rate
--
--   The rate lives in public.fx_rates (refreshed by _shared/fxRates.ts from the 5-minute job, at most
--   every 6h). public.current_usd_idr() is the latest rate if it's under 36h old, else null — the
--   server never prices a loan on a stale guess.
--
--   Repayment → Paid: record_loan_payment (confirm-loan-payment) closes a loan when the USDC paid
--   reaches total_repayment_amount, which is kept current by reprice_id_loans and by the trigger
--   below, so paying the USD amount shown today ends 'Paid'. A part payment converts to rupiah at
--   today's rate; when less than Rp 1.000 is left the trigger closes the loan itself ('Paid',
--   repaid_at, credit_limit_at_repayment — the same fields record_loan_payment sets when full).
--   Every part of this is a no-op for loans with repay_idr null (everyone not on the ID track).

-- ── exchange rates ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.fx_rates (
  id bigint generated always as identity primary key,
  pair text not null default 'USD/IDR',
  rate numeric not null check (rate > 0),
  source text,
  fetched_at timestamptz not null default now()
);
create index if not exists fx_rates_pair_fetched_idx on public.fx_rates (pair, fetched_at desc);

alter table public.fx_rates enable row level security;
drop policy if exists fx_rates_read on public.fx_rates;
create policy fx_rates_read on public.fx_rates for select to authenticated using (true);
-- Writes only from the edge functions (service role). Rates aren't secret.
revoke insert, update, delete on public.fx_rates from anon, authenticated;

-- The latest USD/IDR rate when it's fresh (fetched within 36h), else null.
create or replace function public.current_usd_idr()
returns numeric language sql stable security definer set search_path = '' as $$
  select r.rate
    from public.fx_rates r
   where r.pair = 'USD/IDR' and r.fetched_at > now() - interval '36 hours'
   order by r.fetched_at desc
   limit 1;
$$;

-- For the app: { rate, fetchedAt } (both null when there's no fresh rate).
create or replace function public.get_usd_idr_rate()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('rate', r.rate, 'fetchedAt', r.fetched_at)
       from public.fx_rates r
      where r.pair = 'USD/IDR' and r.fetched_at > now() - interval '36 hours'
      order by r.fetched_at desc
      limit 1),
    jsonb_build_object('rate', null, 'fetchedAt', null));
$$;

revoke execute on function public.current_usd_idr() from public;
revoke execute on function public.get_usd_idr_rate() from public;
-- authenticated needs current_usd_idr: enforce_new_loan_terms runs as the inserting client.
grant execute on function public.current_usd_idr() to anon, authenticated, service_role;
grant execute on function public.get_usd_idr_rate() to anon, authenticated, service_role;

-- ── loan columns ───────────────────────────────────────────────────────────────────────────────
alter table public.loans add column if not exists repay_idr numeric check (repay_idr is null or repay_idr > 0);
alter table public.loans add column if not exists fx_rate_at_request numeric;
alter table public.loans add column if not exists repaid_idr numeric not null default 0;
alter table public.loans add column if not exists fx_alerted_at timestamptz;

comment on column public.loans.repay_idr is 'Indonesia track: the fixed rupiah total the borrower owes. total_repayment_amount (USD) floats with the rate. Null = not pegged.';
comment on column public.loans.fx_rate_at_request is 'USD/IDR (public.current_usd_idr) when the request was made. Server-set.';
comment on column public.loans.repaid_idr is 'Rupiah repaid so far: each USDC repayment × the rate that day. Server-set.';
comment on column public.loans.fx_alerted_at is 'When the team was told USD/IDR moved > 5% from fx_rate_at_request on this loan. Server-set.';

-- Clients can't change the peg after insert. A separate, additive guard (like the refund columns in
-- 20260816100000): enforce_loan_money_columns_service_role_only's deployed body is edited from
-- several places and must not be replaced from a file. MUST stay SECURITY INVOKER.
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
  then
    raise exception 'loans: the rupiah terms can only be changed by the server';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_loan_idr_columns on public.loans;
create trigger trg_enforce_loan_idr_columns
  before update on public.loans
  for each row execute function app_private.enforce_loan_idr_columns_server_only();

-- ── new requests: price an ID request from its rupiah total ─────────────────────────────────────
-- Same function as 20261107120000 (full body) with the peg added: for market 'ID' the client must
-- send repay_idr (whole rupiah, a multiple of 500); the server sets fx_rate_at_request and computes
-- total_repayment_amount = round(repay_idr / rate, 2) BEFORE the ≥ amount + $1 and ≤ 1.5× checks,
-- so those run on the server's USD. Everyone else: repay_idr / fx columns are blanked.
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

  -- Server-only peg columns start empty whatever the client sent.
  new.repaid_idr := 0;
  new.fx_alerted_at := null;
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
    -- +1 day of slack: due_date is midnight UTC of the borrower's local date.
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

-- ── repayments: count them in rupiah ───────────────────────────────────────────────────────────
-- When repaid_amount goes up on a pegged loan: add the payment × today's rate (or the request's
-- rate if there's no fresh one) to repaid_idr, then re-price what's left. A row someone already
-- closed ('Paid' in this update — record_loan_payment when the USDC reached the total, or an admin)
-- is left closed. Otherwise under Rp 1.000 left closes it here, with the same fields
-- record_loan_payment sets on a full payment. No-op when repay_idr is null.
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

  v_rate := coalesce(public.current_usd_idr(), new.fx_rate_at_request);
  if v_rate is null or v_rate <= 0 then
    return new;
  end if;

  -- A server path that set repaid_idr itself in this update wins.
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
      -- Same as record_loan_payment: the limit this loan is measured against, in the update that
      -- marks it Paid (the milestone trigger reads it).
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

drop trigger if exists trg_id_peg_on_repayment on public.loans;
create trigger trg_id_peg_on_repayment
  before update on public.loans
  for each row
  when (new.repay_idr is not null)
  execute function app_private.apply_idr_peg_on_repayment();

-- ── keep the USD due current (the 5-minute job) ────────────────────────────────────────────────
-- Open pegged loans: total_repayment_amount = repaid_amount + rupiah left ÷ today's rate. Also marks
-- (fx_alerted_at) and returns loans whose rate moved > 5% from the request's, once each, so the
-- caller can tell the team. Nothing happens without a fresh rate.
create or replace function public.reprice_id_loans()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_rate numeric := public.current_usd_idr();
  v_count integer := 0;
  v_moved jsonb := '[]'::jsonb;
begin
  if v_rate is null then
    return jsonb_build_object('rate', null, 'repriced', 0, 'moved', '[]'::jsonb);
  end if;

  with upd as (
    update public.loans l
       set total_repayment_amount = round(coalesce(l.repaid_amount, 0) + greatest(0, l.repay_idr - l.repaid_idr) / v_rate, 2)
     where l.repay_idr is not null
       and l.loan_status::text in ('Requested', 'Lent')
       and coalesce(l.repayment_status::text, '') <> 'Paid'
       and l.refunded_at is null
       and l.total_repayment_amount is distinct from
           round(coalesce(l.repaid_amount, 0) + greatest(0, l.repay_idr - l.repaid_idr) / v_rate, 2)
     returning l.id
  )
  select count(*) into v_count from upd;

  with moved as (
    update public.loans l
       set fx_alerted_at = now()
     where l.repay_idr is not null
       and l.fx_alerted_at is null
       and l.fx_rate_at_request > 0
       and l.loan_status::text in ('Requested', 'Lent')
       and coalesce(l.repayment_status::text, '') <> 'Paid'
       and l.refunded_at is null
       and abs(v_rate / l.fx_rate_at_request - 1) > 0.05
     returning l.id, l.tracking_id, l.loan_status, l.loan_amount, l.repay_idr, l.repaid_idr,
               l.total_repayment_amount, l.fx_rate_at_request
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id,
           'trackingId', m.tracking_id,
           'loanStatus', m.loan_status,
           'loanAmount', m.loan_amount,
           'repayIdr', m.repay_idr,
           'repaidIdr', m.repaid_idr,
           'totalRepaymentAmount', m.total_repayment_amount,
           'rateAtRequest', m.fx_rate_at_request,
           'rateNow', v_rate,
           'movePct', round((v_rate / m.fx_rate_at_request - 1) * 100, 1))), '[]'::jsonb)
    into v_moved
    from moved m;

  return jsonb_build_object('rate', v_rate, 'repriced', v_count, 'moved', v_moved);
end;
$$;

revoke execute on function public.reprice_id_loans() from public, anon, authenticated;
grant execute on function public.reprice_id_loans() to service_role;
