-- Milestones use the same "repaid" / "on time" rule as repayment Pandesal points.
--
-- private.is_trust_milestone_complete judged on-time as `updated_at <= due_date`, which was wrong
-- two ways:
--   * updated_at moves on any later edit to the loan (interest return, admin fixes), so a loan
--     repaid early could read as late.
--   * no grace on the due date: due dates are midnight UTC, so a borrower who repaid ON the due
--     date was late here but on time everywhere else, and the dashboard showed the milestone ticked
--     while the points were silently refused.
-- It also counted refunded loans as repayments: a platform-settlement refund reads back as 'Paid'
-- with repaid_amount stamped to the total, and the sync_completed_trust_milestones_on_loans trigger
-- awarded on-time milestones to defaulted borrowers at the moment of the refund.
--
-- Every loan-based branch now uses app_private.is_loan_fully_repaid / is_loan_repaid_on_time
-- (repaid_at, 24h grace on the due date, refunded and test loans excluded): the same helpers
-- award_repayment_pandesal uses. Mirrors supabase/functions/_shared/trustPointRewards.ts and
-- src/views/dashboard/dashboardHelpers.ts. Every other branch is identical to
-- 20261001000000_full_limit_milestone_replays_leveling_rule.sql.

create or replace function private.is_trust_milestone_complete(
  user_id_input uuid,
  milestone_id_input text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  on_time_paid_count integer := 0;
  funded_count integer := 0;
  unique_lender_count integer := 0;
  total_repaid numeric := 0;
  has_unresolved_default boolean := false;
  credit_limit integer := 0;
  replay_limit integer := 15;
  paid_loan public.loans;
  is_verified boolean := false;
begin
  select
    coalesce(u.cs, 0),
    coalesce(
      u.is_world_id::text = 'ACTIVE'
      or u.is_didit::text = 'ACTIVE',
      false
    )
  into credit_limit, is_verified
  from public.users as u
  where u.id = user_id_input;

  select count(*)::integer
  into funded_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.loan_status = 'Lent';

  select count(*)::integer
  into on_time_paid_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and app_private.is_loan_repaid_on_time(l);

  select count(distinct l.lender_user_id)::integer
  into unique_lender_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.loan_status = 'Lent'
    and l.lender_user_id is not null;

  select coalesce(sum(coalesce(l.repaid_amount, 0)), 0)
  into total_repaid
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and app_private.is_loan_fully_repaid(l);

  select exists (
    select 1
    from public.loans as l
    where l.borrower_user_id = user_id_input
      and l.loan_status = 'Lent'
      and coalesce(l.repayment_status::text, 'Unpaid') <> 'Paid'
      and l.due_date < now()
  )
  into has_unresolved_default;

  if milestone_id_input = 'verify-identity' then
    return is_verified;
  elsif milestone_id_input = 'first-loan-request' then
    return exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
    );
  elsif milestone_id_input = 'first-funded-loan' then
    return funded_count >= 1;
  elsif milestone_id_input = 'first-on-time-repayment' then
    return on_time_paid_count >= 1;
  elsif milestone_id_input = 'two-on-time-streak' then
    return on_time_paid_count >= 2;
  elsif milestone_id_input = 'full-limit-credit-builder' then
    for paid_loan in
      select l.*
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and app_private.is_loan_fully_repaid(l)
      order by coalesce(l.repaid_at, l.updated_at), l.id
    loop
      if paid_loan.loan_amount >= replay_limit then
        if app_private.is_loan_repaid_on_time(paid_loan) then
          return true;
        end if;
        select coalesce(min(t), 140) into replay_limit
        from unnest(array[15, 20, 40, 60, 80, 100, 120, 140]) as t
        where t > replay_limit;
      end if;
    end loop;
    return false;
  elsif milestone_id_input = 'two-unique-lenders' then
    return unique_lender_count >= 2;
  elsif milestone_id_input = 'repay-100-total' then
    return total_repaid >= 100;
  elsif milestone_id_input = 'reach-level-three' then
    return is_verified and credit_limit >= 40;
  elsif milestone_id_input = 'trusted-borrower-candidate' then
    return on_time_paid_count >= 5 and unique_lender_count >= 3 and not has_unresolved_default;
  end if;

  return false;
end;
$$;
