-- "Your limit stays at $X" card (George, 2026-11-18): borrowers whose limit didn't go up because of the
-- 48-hour rule (20261118170000_fast_repay_48h) are told why on their dashboard, with a Messenger button
-- to talk about it and a link to add proof of income.
--
-- Shown when, in the last 30 days, either:
--   * the team reset their limit for it (admin_audit_logs action credit_limit_reset_fast_repay), or
--   * they repaid a full-limit loan within 48 hours of getting it (so it didn't level them up) and their
--     limit hasn't gone up since.
create or replace function public.my_limit_notice()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
      and l.funded_at is not null and l.repaid_at - l.funded_at < interval '48 hours'
      and l.repaid_at > now() - interval '30 days'
  )
  select case when me.id is null then jsonb_build_object('show', false)
    else jsonb_build_object(
      'show', (select at from reset) is not null or (select at from fast) is not null,
      'limit', me.cs,
      'since', greatest((select at from reset), (select at from fast)))
  end
  from (select 1) one left join me on true;
$$;

revoke all on function public.my_limit_notice() from public, anon;
grant execute on function public.my_limit_notice() to authenticated;
