-- 1) Record, at repayment, the limit a loan was measured against (loans.credit_limit_at_repayment,
--    written by confirm-loan-payment). The full-limit milestone uses it instead of replaying history
--    from $15, which over-awarded borrowers whose limit was raised another way (a migration, a
--    referral, an admin edit): e.g. cs $20 + a $15 trust-building loan earned "full-limit".
--    Loans repaid before this keep the replay.
-- 2) "Repaid on time" (Pandesal repayment points + milestones) = before the LATER of the old
--    due_date + 24h and the end of the due day in the loan's own zone (loans.due_timezone, #1024).
--    Never stricter than before; borrowers west of UTC stop counting as late while the app still
--    says they're on time.

alter table public.loans add column if not exists credit_limit_at_repayment numeric;
comment on column public.loans.credit_limit_at_repayment is
   'Borrower''s credit limit when this loan was fully repaid (set by confirm-loan-payment). principal >= this = a full-limit loan. Server-only.';

create or replace function app_private.keep_loan_repayment_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.credit_limit_at_repayment := old.credit_limit_at_repayment;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_keep_loan_repayment_limit on public.loans;
create trigger trg_keep_loan_repayment_limit
  before update on public.loans
  for each row execute function app_private.keep_loan_repayment_limit();

create or replace function app_private.is_loan_repaid_on_time(p_loan public.loans)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.is_loan_fully_repaid(p_loan)
    and coalesce(p_loan.repaid_at, p_loan.updated_at) < greatest(
      p_loan.due_date + interval '24 hours',
      (((p_loan.due_date at time zone 'UTC')::date + 1)::timestamp
        at time zone (case when app_private.is_usable_timezone(p_loan.due_timezone) then p_loan.due_timezone else 'Asia/Manila' end))
    );
$$;

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
    -- Recorded at repayment (confirm-loan-payment): principal at or above the limit the borrower
    -- had at that moment, repaid on time.
    if exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.credit_limit_at_repayment is not null
        and l.loan_amount >= l.credit_limit_at_repayment
        and app_private.is_loan_repaid_on_time(l)
    ) then
      return true;
    end if;
    -- Loans repaid before that was recorded: replay the level-up rule over them, from $15.
    for paid_loan in
      select l.*
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.credit_limit_at_repayment is null
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
