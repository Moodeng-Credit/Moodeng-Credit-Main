-- One repay rule (George, 2026-11-27): a full-limit loan grows the limit only when it's paid in the loan's
-- SECOND HALF, from 00:00 on its halfway day (app_private.loan_reward_from_at, the food-voucher window,
-- never sooner than 48h after funding). Decided in _shared/creditAndPoints.ts (countsFromAt) for loans
-- funded from 2026-11-27 00:00 Bangkok; older loans keep the 48-hour rule they were shown.
--
-- my_limit_notice ("Your limit stays at $X" on the dashboard) now also shows for a full-limit loan paid in
-- its first half under the new rule, not only for one paid within 48 hours.

create or replace function public.my_limit_notice()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with me as (
    select u.id, coalesce(u.cs, 15) as cs from public.users u where u.id = auth.uid()
  ),
  reset as (
    select max(a.created_at) as at from public.admin_audit_logs a, me
    where a.target_user_id = me.id and a.action = 'credit_limit_reset_fast_repay' and a.created_at > now() - interval '30 days'
  ),
  fast as (
    select max(l.repaid_at) as at from public.loans l, me
    where l.borrower_user_id = me.id and l.repayment_status = 'Paid' and l.refunded_at is null
      and l.credit_limit_at_repayment is not null and l.loan_amount >= l.credit_limit_at_repayment
      and l.credit_limit_at_repayment >= me.cs
      and l.funded_at is not null
      and l.repaid_at < case
        when l.funded_at >= timestamptz '2026-11-27 00:00:00+07' then app_private.loan_reward_from_at(l)
        else l.funded_at + interval '48 hours'
      end
      and l.repaid_at > now() - interval '30 days'
  )
  select case when me.id is null then jsonb_build_object('show', false)
    else jsonb_build_object(
      'show', (select at from reset) is not null or (select at from fast) is not null,
      'limit', me.cs,
      'since', greatest((select at from reset), (select at from fast)))
  end
  from (select 1) one left join me on true;
$function$;
