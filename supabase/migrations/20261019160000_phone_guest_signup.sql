-- Phone-first sign-up for Facebook/Messenger browsers (phone guests).
--
-- Same idea as the email guest sign-up (20261016160000_guest_email_signup.sql): someone types their
-- Philippine mobile number and goes straight into onboarding, with no code. The app signs them in
-- anonymously (a guest) and attaches the number here, unconfirmed. No text is sent. Once they're
-- approved after the video call, the guest gate asks them to add an email and a password, like
-- email guests.
--
-- Attaching the number (unconfirmed) to the guest's login means that if Facebook loses their
-- session, signing in with that number texts them a code (the Send SMS hook) and gets them back in:
-- Supabase finds the account by phone even while it's unconfirmed (tested 19 Oct 2026). The number
-- is also unique in auth.users, so two accounts can't hold it.
--
-- Guests stay guests: is_anonymous is untouched, so loans, transactions and KYC stay refused until
-- the email is confirmed.

-- 09XX…, 9XX…, 63 9XX… or +63 9XX… (any spaces or dashes) → 639XXXXXXXXX, the way auth.users stores phones.
CREATE OR REPLACE FUNCTION public.ph_mobile_digits(p_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN d ~ '^639[0-9]{9}$' THEN d
    WHEN d ~ '^09[0-9]{9}$' THEN '63' || substr(d, 2)
    WHEN d ~ '^9[0-9]{9}$' THEN '63' || d
  END
  FROM (SELECT regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') AS d) s;
$$;

-- Whether a Philippine mobile number already belongs to an account, so the sign-up form can say
-- "This number already has a Moodeng account" instead of making a second one. Like email_exists.
CREATE OR REPLACE FUNCTION public.phone_has_account(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE phone = public.ph_mobile_digits(p_phone));
$$;

REVOKE ALL ON FUNCTION public.phone_has_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phone_has_account(text) TO anon, authenticated;

-- Attaches a number to the caller's own guest login, unconfirmed and without sending anything.
-- Returns 'ok', 'taken' (another account has it), 'invalid' (not a PH mobile) or 'not_guest'.
CREATE OR REPLACE FUNCTION public.claim_guest_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_digits text := public.ph_mobile_digits(p_phone);
BEGIN
  IF v_digits IS NULL THEN
    RETURN 'invalid';
  END IF;
  IF auth.uid() IS NULL OR NOT coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RETURN 'not_guest';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE phone = v_digits AND id <> auth.uid()) THEN
    RETURN 'taken';
  END IF;

  UPDATE auth.users
     SET phone = v_digits, updated_at = now()
   WHERE id = auth.uid()
     AND is_anonymous
     AND phone_confirmed_at IS NULL;
  IF NOT FOUND THEN
    RETURN 'not_guest';
  END IF;
  RETURN 'ok';
EXCEPTION WHEN unique_violation THEN
  RETURN 'taken';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_guest_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_guest_phone(text) TO authenticated;
