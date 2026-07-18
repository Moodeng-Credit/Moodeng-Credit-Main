-- Separate real customers/loans from test & team data so admin analytics reflect reality.
--
-- Confirmed with George (2026-07-18): the only REAL borrowers are the Filipino customers
-- Belle (d.rosebellejane), Jaja (jollysakura19), and Princess (cabantuganprincess20).
-- jeramie (jeramiesaito@gmail.com) is a real lender. Everything else — team/staff accounts
-- (Emma_Moodeng, george22, Anthony, Menno, moodengcredit), $1 self-loan test loops, $0.10
-- smoke tests, and the ~88 signups that never touched a funded loan — is test.
--
-- `is_test` is an admin-DISPLAY flag only: it drives "hide test data" in the admin dashboards.
-- It does NOT touch RLS, the money-lock triggers, or anyone's app experience. New rows default
-- to false (real) so genuine future signups are counted; test data is historical and seeded here.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_is_test ON public.users (is_test);
CREATE INDEX IF NOT EXISTS idx_loans_is_test ON public.loans (is_test);

-- Real people, matched by their (stable) sign-up email.
CREATE TEMP TABLE _real_emails (email TEXT) ON COMMIT DROP;
INSERT INTO _real_emails (email) VALUES
  ('d.rosebellejane@gmail.com'),  -- Belle (borrower)
  ('jollysakura19@gmail.com'),    -- Jaja (borrower)
  ('cabantuganprincess20@gmail.com'), -- Princess (borrower)
  ('jeramiesaito@gmail.com');     -- jeramie (real lender)

-- Users: everything test, then un-flag the four confirmed-real accounts.
UPDATE public.users SET is_test = true WHERE is_test = false;
UPDATE public.users u SET is_test = false
WHERE lower(u.email) IN (SELECT email FROM _real_emails);

-- Loans: a loan is real when a real Filipino CUSTOMER borrowed (regardless of who funded it —
-- a team/jeramie lender funding Belle is still a real loan to Belle). jeramie is a lender only,
-- so no loan is real via jeramie.
UPDATE public.loans SET is_test = true WHERE is_test = false;
UPDATE public.loans l SET is_test = false
WHERE l.borrower_user_id IN (
  SELECT u.id FROM public.users u
  WHERE lower(u.email) IN ('d.rosebellejane@gmail.com', 'jollysakura19@gmail.com', 'cabantuganprincess20@gmail.com')
);

-- Admin-only toggle so misclassifications (or future test data) can be fixed from the panel.
-- SECURITY DEFINER + an explicit is_moodeng_admin() check: it must bypass RLS to write these
-- tables, and the admin gate — NOT current_user — is what authorizes it. It only ever writes
-- is_test, so bypassing the money/verification column-lock triggers is harmless.
CREATE OR REPLACE FUNCTION public.admin_set_entity_test(p_entity TEXT, p_id UUID, p_is_test BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT app_private.is_moodeng_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_entity = 'user' THEN
    UPDATE public.users SET is_test = p_is_test WHERE id = p_id;
  ELSIF p_entity = 'loan' THEN
    UPDATE public.loans SET is_test = p_is_test WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Unknown entity %', p_entity USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_entity_test(TEXT, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_entity_test(TEXT, UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_entity_test(TEXT, UUID, BOOLEAN) TO authenticated;
