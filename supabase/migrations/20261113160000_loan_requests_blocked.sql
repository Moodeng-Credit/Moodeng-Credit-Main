-- Per-account switch that stops a borrower from posting loan requests.
-- Used for testers: fully verified borrower accounts that must never put a real request on the board.
-- Server/admin only: the borrower can't flip it from the app.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS loan_requests_blocked BOOLEAN NOT NULL DEFAULT false;

-- Keep the switch out of the borrower's hands.
CREATE OR REPLACE FUNCTION private.lock_loan_requests_blocked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF tg_op = 'INSERT' THEN
      new.loan_requests_blocked := false;
    ELSE
      new.loan_requests_blocked := old.loan_requests_blocked;
    END IF;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_loan_requests_blocked ON public.users;
CREATE TRIGGER trg_lock_loan_requests_blocked
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION private.lock_loan_requests_blocked();

-- Refuse new loan requests from blocked accounts (the app inserts loans as the borrower).
-- Not SECURITY DEFINER: current_user must stay the caller's role (the borrower can read their own row).
CREATE OR REPLACE FUNCTION private.enforce_loan_requests_blocked()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR new.borrower_user_id IS NULL THEN
    RETURN new;
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE id = new.borrower_user_id AND loan_requests_blocked) THEN
    RAISE EXCEPTION 'loan_requests_blocked: this account can''t post loan requests'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_loan_requests_blocked ON public.loans;
CREATE TRIGGER trg_enforce_loan_requests_blocked
  BEFORE INSERT ON public.loans
  FOR EACH ROW EXECUTE FUNCTION private.enforce_loan_requests_blocked();
