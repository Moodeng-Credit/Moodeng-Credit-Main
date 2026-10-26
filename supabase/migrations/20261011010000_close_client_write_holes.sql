-- Close client write holes found in the 2026-10-10 security sweep.

-- 1. Read-only views had Supabase's default write grants. public_user_profiles is a
--    security-definer, auto-updatable view over users, so anyone with the anon key could
--    UPDATE or DELETE any users row through it.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.public_user_profiles, public.borrower_insights,
   public.admin_overdue_or_defaulted_loans FROM anon, authenticated;

-- 2. Tables no client writes, protected only by "no policy" today. Belt and braces.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.admin_users, public.user_rewards,
   public.cashout_face_checks, public.transactions FROM anon, authenticated;

-- 3. No client updates loans (every server path is SECURITY DEFINER or service role), but these
--    policies let a borrower or lender rewrite borrower_user_id, created_at, reason... on their loans
--    — e.g. move an overdue debt onto another user.
DROP POLICY IF EXISTS "Borrowers can update their loans" ON public.loans;
DROP POLICY IF EXISTS "Lenders can update loans they fund" ON public.loans;

-- 4. users: role is picked once (role selection, NULL -> value); switching it later skipped the
--    pre-KYC gate (lenders are exempt). chat_id is set by the Telegram connect function only;
--    pointing it at someone else's chat redirected alerts.
CREATE OR REPLACE FUNCTION public.enforce_user_role_and_chat_server_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN new;
  END IF;
  IF (old.user_role IS NOT NULL AND new.user_role IS DISTINCT FROM old.user_role)
     OR new.chat_id IS DISTINCT FROM old.chat_id THEN
    RAISE EXCEPTION 'users: role and Telegram chat can only be changed by server-side code';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_role_and_chat ON public.users;
CREATE TRIGGER trg_enforce_user_role_and_chat
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_and_chat_server_only();
