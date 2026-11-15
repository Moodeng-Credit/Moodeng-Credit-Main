-- Two-payment loans (George, 2026-11-15): ONE loan, paid back in milestones.
--
-- loans.repayment_schedule = [{"due":"YYYY-MM-DD","amount":n}, ...]. NULL = a normal single payment.
-- due_date stays the FINAL payment's date (lenders, the BitRepo vault and every due_date reader see
-- the loan's real length); total_repayment_amount is the full total; repaid_amount accumulates as
-- usual. Reminders and the repay screen read the schedule for the next payment.
--
-- Rules (src/lib/repaymentSchedule.ts mirrors them):
--   * exactly 2 parts for now, each > 0, whole cents, dates ascending
--   * parts add up to total_repayment_amount
--   * only for loans over $60
--   * the last part's day is the due_date's day (in the loan's timezone; ±1 day for UTC storage)
-- Checked for every writer (borrower, admin, edge functions), on insert and whenever the schedule
-- itself changes. Changing due_date/total on a scheduled loan later (Vault Lend records funding with
-- the same values) is checked too, so the two can't drift apart.

ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS repayment_schedule jsonb;
COMMENT ON COLUMN public.loans.repayment_schedule IS
  'Milestone payments for one loan: [{"due":"YYYY-MM-DD","amount":n}], ascending, summing to total_repayment_amount. NULL = single payment on due_date.';

CREATE OR REPLACE FUNCTION private.enforce_loan_repayment_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  s jsonb := new.repayment_schedule;
  part jsonb;
  prev_due date;
  part_due date;
  part_amount numeric;
  total numeric := 0;
  final_day date;
BEGIN
  IF s IS NULL OR jsonb_typeof(s) = 'null' THEN
    new.repayment_schedule := NULL;
    RETURN new;
  END IF;
  IF tg_op = 'UPDATE'
     AND s IS NOT DISTINCT FROM old.repayment_schedule
     AND new.total_repayment_amount IS NOT DISTINCT FROM old.total_repayment_amount
     AND new.due_date IS NOT DISTINCT FROM old.due_date THEN
    RETURN new;
  END IF;

  IF jsonb_typeof(s) <> 'array' OR jsonb_array_length(s) <> 2 THEN
    RAISE EXCEPTION 'loans: a split repayment must have exactly 2 payments' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(new.loan_amount, 0) <= 60 THEN
    RAISE EXCEPTION 'loans: only loans over $60 can be paid back in 2 parts' USING ERRCODE = 'P0001';
  END IF;

  FOR part IN SELECT value FROM jsonb_array_elements(s) LOOP
    BEGIN
      part_due := (part ->> 'due')::date;
      part_amount := (part ->> 'amount')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'loans: each payment needs a due day and an amount' USING ERRCODE = 'P0001';
    END;
    IF part_due IS NULL OR part_amount IS NULL OR part_amount <= 0 OR part_amount <> round(part_amount, 2) THEN
      RAISE EXCEPTION 'loans: each payment needs a due day and an amount in whole cents' USING ERRCODE = 'P0001';
    END IF;
    IF prev_due IS NOT NULL AND part_due <= prev_due THEN
      RAISE EXCEPTION 'loans: payment dates must be in order' USING ERRCODE = 'P0001';
    END IF;
    prev_due := part_due;
    total := total + part_amount;
  END LOOP;

  IF total <> new.total_repayment_amount THEN
    RAISE EXCEPTION 'loans: the payments ($%) must add up to the repayment total ($%)', round(total, 2), round(new.total_repayment_amount, 2)
      USING ERRCODE = 'P0001';
  END IF;

  final_day := (new.due_date AT TIME ZONE coalesce(nullif(new.due_timezone, ''), 'Asia/Manila'))::date;
  IF new.due_date IS NULL OR abs(prev_due - final_day) > 1 THEN
    RAISE EXCEPTION 'loans: the last payment must be due on the loan''s due date' USING ERRCODE = 'P0001';
  END IF;

  RETURN new;
END;
$$;

-- "zz_" so it runs after set_loan_due_timezone and the other BEFORE triggers that adjust the row.
DROP TRIGGER IF EXISTS zz_enforce_loan_repayment_schedule ON public.loans;
CREATE TRIGGER zz_enforce_loan_repayment_schedule
  BEFORE INSERT OR UPDATE OF repayment_schedule, total_repayment_amount, due_date ON public.loans
  FOR EACH ROW EXECUTE FUNCTION private.enforce_loan_repayment_schedule();
