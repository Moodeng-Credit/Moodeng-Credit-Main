-- Fix: verify-identity milestone was unreachable for Didit / World ID Passport users.
--
-- The app's canonical verification rule (src/lib/isUserVerified.ts) treats a user as
-- verified when ANY of World ID, World ID Passport, or Didit KYC is ACTIVE. The dashboard
-- uses that rule to mark the "verify-identity" milestone complete and then calls
-- record_milestone_completion. But private.is_trust_milestone_complete only checked
-- is_world_id = 'ACTIVE', so borrowers who verified via Didit (e.g. the combined flow) or
-- World ID Passport were rejected with "Milestone criteria not met" (errcode 23514) on
-- every dashboard load — the award never persisted, so it retried and errored indefinitely.
--
-- This redefines the function with is_verified matching the canonical OR-of-three rule.
-- Only the is_verified computation changes; every other branch is byte-for-byte identical
-- to 20260521001000_separate_borrower_trust_points.sql. is_verified also gates
-- 'reach-level-three', which is corrected by the same change.

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
  is_verified boolean := false;
begin
  select
    coalesce(u.cs, 0),
    coalesce(
      u.is_world_id::text = 'ACTIVE'
      or u.is_world_id_passport::text = 'ACTIVE'
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
    return exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.repayment_status = 'Paid'
        and coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
        and l.updated_at <= l.due_date
        and l.loan_amount in (15, 20, 40, 60, 80, 100, 120, 140)
    );
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
