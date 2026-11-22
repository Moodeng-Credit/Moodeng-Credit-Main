-- Hand-set payment plans (George, 2026-11-22): a borrower who can't repay at once pays a fixed amount
-- each month until the loan is paid off (e.g. $20 a month). Same loans.repayment_schedule
-- the 2-part split uses (reminders, repay screen, late checks all follow the next unpaid part), but:
-- any number of parts (2–24), any positive amounts, no $60 / 28-day / equal-parts rules.
-- Only the team sets one (service role / SQL), and loans.repayment_plan_note says who and why.

alter table public.loans add column if not exists repayment_plan_note text;
comment on column public.loans.repayment_plan_note is
   'Set = hand-set payment plan (team only): repayment_schedule may have 2–24 parts of any amount. Who/why, e.g. "George 2026-11-22: $20 a month".';

create or replace function private.enforce_loan_repayment_schedule()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  s jsonb := new.repayment_schedule;
  part jsonb;
  prev_due date;
  part_due date;
  part_amount numeric;
  first_amount numeric;
  total numeric := 0;
  final_day date;
  start_day date;
  zone text := coalesce(nullif(new.due_timezone, ''), 'Asia/Manila');
  hand_plan boolean := nullif(trim(coalesce(new.repayment_plan_note, '')), '') is not null;
begin
  -- Only the team can mark a loan as a hand-set plan.
  if new.repayment_plan_note is distinct from (case when tg_op = 'UPDATE' then old.repayment_plan_note end)
     and coalesce(current_setting('request.jwt.claim.role', true), '') not in ('', 'service_role')
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'loans: only the team can set a payment plan' using errcode = 'P0001';
  end if;

  if s is null or jsonb_typeof(s) = 'null' then
    new.repayment_schedule := null;
    return new;
  end if;
  if tg_op = 'UPDATE'
     and s is not distinct from old.repayment_schedule
     and new.total_repayment_amount is not distinct from old.total_repayment_amount
     and new.due_date is not distinct from old.due_date
     and new.repayment_plan_note is not distinct from old.repayment_plan_note then
    return new;
  end if;

  if hand_plan then
    if jsonb_typeof(s) <> 'array' or jsonb_array_length(s) not between 2 and 24 then
      raise exception 'loans: a payment plan must have 2 to 24 payments' using errcode = 'P0001';
    end if;
  else
    if jsonb_typeof(s) <> 'array' or jsonb_array_length(s) <> 2 then
      raise exception 'loans: a split repayment must have exactly 2 payments' using errcode = 'P0001';
    end if;
    if coalesce(new.loan_amount, 0) <= 60 then
      raise exception 'loans: only loans over $60 can be paid back in 2 parts' using errcode = 'P0001';
    end if;
  end if;

  for part in select value from jsonb_array_elements(s) loop
    begin
      part_due := (part ->> 'due')::date;
      part_amount := (part ->> 'amount')::numeric;
    exception when others then
      raise exception 'loans: each payment needs a due day and an amount' using errcode = 'P0001';
    end;
    if part_due is null or part_amount is null or part_amount <= 0 or part_amount <> round(part_amount, 2) then
      raise exception 'loans: each payment needs a due day and an amount in whole cents' using errcode = 'P0001';
    end if;
    if prev_due is not null and part_due <= prev_due then
      raise exception 'loans: payment dates must be in order' using errcode = 'P0001';
    end if;
    if first_amount is null then
      first_amount := part_amount;
    elsif not hand_plan and abs(part_amount - first_amount) > 0.011 then
      raise exception 'loans: the 2 payments must be the same amount' using errcode = 'P0001';
    end if;
    prev_due := part_due;
    total := total + part_amount;
  end loop;

  if total <> new.total_repayment_amount then
    raise exception 'loans: the payments ($%) must add up to the repayment total ($%)', round(total, 2), round(new.total_repayment_amount, 2)
      using errcode = 'P0001';
  end if;

  final_day := (new.due_date at time zone zone)::date;
  if new.due_date is null or abs(prev_due - final_day) > 1 then
    raise exception 'loans: the last payment must be due on the loan''s due date' using errcode = 'P0001';
  end if;

  if not hand_plan then
    start_day := (coalesce(case when tg_op = 'UPDATE' then old.created_at end, now()) at time zone zone)::date;
    if prev_due - start_day < 27 then
      raise exception 'loans: a loan must run at least 28 days to be paid back in 2 parts' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists zz_enforce_loan_repayment_schedule on public.loans;
create trigger zz_enforce_loan_repayment_schedule
  before insert or update of repayment_schedule, total_repayment_amount, due_date, repayment_plan_note on public.loans
  for each row execute function private.enforce_loan_repayment_schedule();
