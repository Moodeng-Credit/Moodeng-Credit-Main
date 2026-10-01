-- Fix: 'full-limit-credit-builder' milestone counted ANY on-time loan whose amount was a tier value
-- (15, 20, 40, ...). A $15 loan taken at a $20 limit is a trust-building loan under the leveling rule
-- (only a loan at or above the current limit levels you up), but it still earned this milestone.
--
-- The milestone now replays the level-up rule: walking fully repaid, non-refunded loans in order from
-- the $15 starting limit, a loan at or above the limit at that time is a full-limit loan (and unlocks
-- the next tier); the milestone is met when one of those was repaid on time. Mirrors
-- src/views/dashboard/dashboardHelpers.ts and supabase/functions/_shared/trustPointRewards.ts.
-- Already-recorded completions are left alone. Every other branch is identical to
-- 20260803000000_fix_verify_identity_milestone_all_methods.sql.

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
  paid_loan record;
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
    and l.repayment_status = 'Paid'
    and coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
    and l.updated_at <= l.due_date;

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
    and l.repayment_status = 'Paid';

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
      select l.loan_amount, l.updated_at, l.due_date
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.repayment_status = 'Paid'
        and l.refunded_at is null
        and coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
      order by l.updated_at, l.id
    loop
      if paid_loan.loan_amount >= replay_limit then
        if paid_loan.updated_at <= paid_loan.due_date then
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
