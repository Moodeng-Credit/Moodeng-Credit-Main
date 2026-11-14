-- The retired Rising voucher stays claimable for people who reached 60 Pandesal before the streak
-- rewards (20261114150000). 60 could also be reached off a loan repaid within the hour, which the
-- 24-hour rule says earns nothing. So it now also needs an on-time repayment that counts (held a
-- day) made before the same cutoff. A later repayment can't bring it back: the streak pays from there.

create or replace function app_private.reached_rising_before_streaks(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select sum(e.delta) from public.trust_point_events e
    where e.user_id = p_user_id and e.created_at < timestamptz '2026-11-14 17:00:00+00'
  ), 0) / 1000000.0 >= 60
  and exists (
    select 1
    from public.loans l
    where l.borrower_user_id = p_user_id
      and l.repayment_status = 'Paid'
      and l.refunded_at is null
      and not coalesce(l.is_test, false)
      and coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l)
      and app_private.loan_counts_for_rewards(l)
      and coalesce(l.repaid_at, l.updated_at) < timestamptz '2026-11-14 17:00:00+00'
  );
$function$;
