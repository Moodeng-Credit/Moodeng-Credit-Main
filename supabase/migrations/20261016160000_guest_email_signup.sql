-- Email-first sign-up for Facebook/Messenger browsers (guest accounts).
--
-- Someone signing up inside Facebook's browser types an email and goes straight into onboarding:
-- the app creates a Supabase anonymous ("guest") account and attaches the email as a pending
-- change, which mails them a link + code. They confirm it (and set a password) right after
-- connecting Facebook, before KYC or a loan. Until then the account is a guest:
--   * public.users.email is a placeholder, guest_<id>@moodeng.app (never the unconfirmed address);
--   * the database refuses loans and transactions from guests (below);
--   * create-didit-session refuses to start KYC for guests.
-- The confirmed address only reaches public.users through Supabase Auth (trigger below), so an
-- unconfirmed email can never be used to sign in or to receive anything.
--
-- Switch: guest_signup_enabled in telegram_bot_settings (off by default). Supabase's
-- "Allow anonymous sign-ins" must also be on.

INSERT INTO public.telegram_bot_settings (key, value)
VALUES ('guest_signup_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Read by the sign-up form before anyone is signed in.
CREATE OR REPLACE FUNCTION public.get_guest_signup_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value = 'true' FROM public.telegram_bot_settings WHERE key = 'guest_signup_enabled'), false);
$$;

REVOKE ALL ON FUNCTION public.get_guest_signup_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_signup_enabled() TO anon, authenticated;

-- True for a Supabase anonymous (guest) session.
CREATE OR REPLACE FUNCTION public.current_user_is_guest()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_guest() TO anon, authenticated;

-- Guests can't request a loan or create transactions (fund, repay) until their email is confirmed.
DROP POLICY IF EXISTS "guests cannot create loans" ON public.loans;
CREATE POLICY "guests cannot create loans" ON public.loans
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.current_user_is_guest());

DROP POLICY IF EXISTS "guests cannot create transactions" ON public.transactions;
CREATE POLICY "guests cannot create transactions" ON public.transactions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.current_user_is_guest());

-- When a guest confirms their email (by code or by the link, in any browser), swap the placeholder
-- in public.users for the confirmed address.
CREATE OR REPLACE FUNCTION public.sync_guest_confirmed_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF new.email IS NOT NULL AND new.email IS DISTINCT FROM old.email THEN
    UPDATE public.users
       SET email = lower(new.email)
     WHERE id = new.id
       AND email LIKE 'guest\_%@moodeng.app';
  END IF;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'sync_guest_confirmed_email failed for %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_guest_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_guest_email_confirmed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_guest_confirmed_email();

REVOKE EXECUTE ON FUNCTION public.sync_guest_confirmed_email() FROM PUBLIC, anon, authenticated;
