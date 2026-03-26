-- Onboarding role (MOO-94): borrower vs lender, persisted on public.users.
-- Fixes PostgREST PGRST204 when PATCH includes user_role.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS user_role text;

ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_user_role_check;

ALTER TABLE public.users
ADD CONSTRAINT users_user_role_check
CHECK (user_role IS NULL OR user_role IN ('borrower', 'lender'));

COMMENT ON COLUMN public.users.user_role IS 'User-selected account role from onboarding (borrower or lender).';
