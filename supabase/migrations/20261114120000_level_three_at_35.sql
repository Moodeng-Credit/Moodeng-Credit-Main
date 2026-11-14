-- Credit ladder moves to $15, $25, $35, $45 … (+$10 a level). Level 3 is now $35, so the
-- "Reach Credit Level 3" milestone pays at a $35 limit (was $40). Same effort as before: two level-ups.
-- Only the reach-level-three branch changes. This copies the definition from
-- 20261003122000_milestones_use_recorded_limit_only.sql: before applying, diff it against the live one
-- (select pg_get_functiondef('private.is_trust_milestone_complete(uuid,text)'::regprocedure)).

create or replace function private.is_trust_milestone_complete(user_id_input uuid, milestone_id_input text)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
      and now() >= app_private.loan_past_due_at(l)
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
    -- A full-limit loan: principal at or above the limit recorded when it was repaid, repaid on time.
    return exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.credit_limit_at_repayment is not null
        and l.loan_amount >= l.credit_limit_at_repayment
        and app_private.is_loan_repaid_on_time(l)
    );
  elsif milestone_id_input = 'two-unique-lenders' then
    return unique_lender_count >= 2;
  elsif milestone_id_input = 'repay-100-total' then
    return total_repaid >= 100;
  elsif milestone_id_input = 'reach-level-three' then
    return is_verified and credit_limit >= 35;
  elsif milestone_id_input = 'trusted-borrower-candidate' then
    return on_time_paid_count >= 5 and unique_lender_count >= 3 and not has_unresolved_default;
  end if;

  return false;
end;
$function$;
