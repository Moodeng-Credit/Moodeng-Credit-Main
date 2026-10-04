-- 1) Moving a loan's due date later resets the reminders sent for the old date.
--    loan-due-notifications / loan-overdue-notifications send each reminder once per loan and type
--    (loan_notifications), so after an extension the borrower got no "due tomorrow / due today /
--    overdue" for the new date. A trigger (not just admin_extend_loan) so a due date moved by hand
--    is covered too. Funded / repayment / digest rows are left alone.
create or replace function app_private.reset_due_reminders_on_extension()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  delete from public.loan_notifications
   where loan_id = new.id
     and notification_type in (
       'urgent_reminder', 'final_reminder', 'due_today', 'team_due_today',
       'overdue', 'overdue_followup_3', 'overdue_followup_7', 'team_overdue'
     );
  return new;
end;
$$;

drop trigger if exists trg_reset_due_reminders_on_extension on public.loans;
create trigger trg_reset_due_reminders_on_extension
  after update of due_date on public.loans
  for each row
  when (new.due_date > old.due_date and new.loan_status = 'Lent' and new.repayment_status is distinct from 'Paid')
  execute function app_private.reset_due_reminders_on_extension();

-- 2) New requests from the app: the same terms the request form enforces. The repayment is at least
--    $1 more than the loan, and the due date is between today and 120 days out. Generous margins
--    (2 days back, 122 ahead) because due_date is the borrower's local date at midnight UTC.
create or replace function app_private.enforce_new_loan_terms()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.total_repayment_amount is null or new.total_repayment_amount < new.loan_amount then
    raise exception 'loans: the repayment total can''t be less than the amount borrowed';
  end if;
  if new.total_repayment_amount < new.loan_amount + 1 then
    raise exception 'loans: the repayment must be at least $1 more than the amount borrowed';
  end if;
  if new.loan_amount <> round(new.loan_amount, 2) or new.total_repayment_amount <> round(new.total_repayment_amount, 2) then
    raise exception 'loans: amounts must be in whole cents';
  end if;
  if new.due_date is null or new.due_date < now() - interval '2 days' or new.due_date > now() + interval '122 days' then
    raise exception 'loans: the repayment date must be between today and 120 days from now';
  end if;
  new.credit_limit_at_repayment := null;
  new.refunded_at := null;
  new.refund_reason := null;
  new.refunded_by := null;
  new.refund_hash := null;
  new.offplatform_settlement_note := null;
  return new;
end;
$$;
