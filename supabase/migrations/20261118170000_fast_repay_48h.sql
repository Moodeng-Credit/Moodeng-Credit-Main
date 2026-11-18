-- A loan repaid within 48 hours of getting it doesn't count (George, 2026-11-18): no credit level-up,
-- no affiliate $5 for the inviter, no food voucher. People were borrowing for 30 days and repaying on
-- day 1–2 to climb levels fast (one referral group repaid in 1–3 days, one in 52 minutes).
--
--   * Level-ups: decided in _shared/creditAndPoints.ts (evaluateCreditProgression, the only writer of
--     users.cs) — not here.
--   * loan_counts_for_rewards (affiliate gate + the friend test, and food vouchers for repayments before
--     the halfway rule's cutoff): 24h → 48h. Applies to past repayments too (George's call).
--   * loan_reward_from_at (food vouchers' halfway rule): never sooner than 48h after funding (was 24h).
-- Borrowers are told on the repay screen before paying ("won't raise your limit; from <date> it will")
-- and on the paid screen after.

create or replace function app_private.loan_counts_for_rewards(p_loan public.loans)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select coalesce(p_loan.repaid_at, p_loan.updated_at) - coalesce(p_loan.funded_at, p_loan.created_at) >= interval '48 hours';
$function$;

create or replace function app_private.loan_reward_from_at(p_loan public.loans)
returns timestamptz
language sql
stable
set search_path to ''
as $function$
  with z as (
    select case when app_private.is_usable_timezone(p_loan.due_timezone) then p_loan.due_timezone else 'Asia/Manila' end as zone,
      coalesce(p_loan.funded_at, p_loan.created_at) as funded,
      app_private.loan_day_end((p_loan.due_date at time zone 'UTC')::date, p_loan.due_timezone) as final_due
  ),
  h as (
    select z.*, z.funded + (z.final_due - z.funded) / 2 as halfway from z
  )
  select greatest(((h.halfway at time zone h.zone)::date)::timestamp at time zone h.zone, h.funded + interval '48 hours') from h;
$function$;
