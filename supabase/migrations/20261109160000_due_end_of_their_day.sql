-- One deadline everywhere: a loan is due until the END of its due day on the borrower's clock
-- (loans.due_timezone, else Manila) and overdue from 00:00 the next day there.
--
-- Before this, "late" (points, vouchers, has_overdue_loan, lender default) used the LATER of that and
-- due_date + 24h, which in Manila is 8 AM the next day, while Repay and the reminders already said
-- "due until 11:59 PM". Borrowers were told one deadline and judged on another. Now there is only the
-- one they see. Checked before applying: no past repayment flips from on time to late.
--
-- Mirrors src/utils/loanOverdue.ts getLoanPastDueAt and supabase/functions/_shared/loanDeadline.ts
-- pastDueAt.

create or replace function app_private.loan_past_due_at(p_loan public.loans)
returns timestamptz
language sql
stable
set search_path to ''
as $$
  select ((p_loan.due_date at time zone 'UTC')::date + 1)::timestamp
    at time zone (case when app_private.is_usable_timezone(p_loan.due_timezone) then p_loan.due_timezone else 'Asia/Manila' end);
$$;

create or replace function app_private.is_loan_repaid_on_time(p_loan public.loans)
returns boolean
language sql
stable
set search_path to ''
as $$
  select app_private.is_loan_fully_repaid(p_loan)
    and coalesce(p_loan.repaid_at, p_loan.updated_at) < app_private.loan_past_due_at(p_loan);
$$;

-- Was a flat due_date + 24h with no time zone; now the same end-of-their-day deadline.
create or replace function app_private.has_on_time_repayment(p_user_id uuid, p_exclude_lender uuid default null::uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.loans l
    where l.borrower_user_id = p_user_id
      and l.repayment_status = 'Paid'
      and l.refunded_at is null
      and not coalesce(l.is_test, false)
      and (p_exclude_lender is null or l.lender_user_id is distinct from p_exclude_lender)
      and case
            when coalesce(l.total_repayment_amount, 0) > 0 then coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
            else coalesce(l.repaid_amount, 0) > 0
          end
      and coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l)
  );
$$;
