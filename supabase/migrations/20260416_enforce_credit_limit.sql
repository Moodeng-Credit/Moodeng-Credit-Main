-- Migration: Enforce credit limit and credit building loan rules
-- Created: 2026-04-16
--
-- Rules:
--   1. A borrower's combined active loan amounts cannot exceed their credit limit (cs)
--   2. Only one credit building loan (loan_amount = credit limit) allowed at a time
--
-- Depends on:
--   public.users.cs       = credit limit (integer, same unit as loan_amount)
--   public.loans.loan_status IN ('Requested', 'Lent')
--   public.loans.repayment_status != 'Paid'

CREATE OR REPLACE FUNCTION public.check_loan_credit_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_credit_limit NUMERIC;
  active_loan_total NUMERIC;
BEGIN
  -- 1. Get the borrower's credit limit from their credit score (cs)
  SELECT cs INTO user_credit_limit
  FROM public.users
  WHERE id = NEW.borrower_user_id;

  -- If no user found, block the loan
  IF user_credit_limit IS NULL THEN
    RAISE EXCEPTION 'User not found or credit limit not set';
  END IF;

  -- 2. Sum all currently active loans for this borrower
  SELECT COALESCE(SUM(loan_amount), 0) INTO active_loan_total
  FROM public.loans
  WHERE borrower_user_id = NEW.borrower_user_id
    AND loan_status IN ('Requested', 'Lent')
    AND repayment_status != 'Paid';

  -- 3. Block if combined loans would exceed credit limit
  IF (active_loan_total + NEW.loan_amount) > user_credit_limit THEN
    RAISE EXCEPTION 'Loan request rejected: combined active loans would exceed your credit limit of %', user_credit_limit;
  END IF;

  -- 4. Credit building loan check:
  --    If this loan maxes out the credit limit, only one is allowed at a time
  IF NEW.loan_amount = user_credit_limit THEN
    IF EXISTS (
      SELECT 1
      FROM public.loans
      WHERE borrower_user_id = NEW.borrower_user_id
        AND loan_amount = user_credit_limit
        AND loan_status IN ('Requested', 'Lent')
        AND repayment_status != 'Paid'
    ) THEN
      RAISE EXCEPTION 'Loan request rejected: you already have an active credit building loan';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it already exists (safe re-run)
DROP TRIGGER IF EXISTS enforce_credit_limit ON public.loans;

-- Attach trigger: fires before every INSERT on loans
CREATE TRIGGER enforce_credit_limit
  BEFORE INSERT ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION public.check_loan_credit_limit();
