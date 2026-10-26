-- A sign-up that was started but never finished blocked its email forever.
--
-- With "Confirm email" ON, an email+password or email-code sign-up creates the Supabase login
-- (auth.users) straight away, unconfirmed. If the person never confirms, that row keeps the email:
-- coming back (especially in Facebook's/Messenger's browser, where sign-up is the guest flow that
-- attaches the email to an anonymous account) Supabase answers email_exists and the app says "This
-- email already has a Moodeng account". 6 such rows on 2026-10-18; one real person was blocked.
--
-- release_unfinished_signup(email) deletes the login for that email ONLY when it is an abandoned
-- sign-up: never confirmed, never signed in, not a guest, no profile (public.users), and older than
-- 2 minutes (so a sign-up in progress in another tab isn't cut off). Such a row has no wallet, no
-- Openfort player and nothing else in the app. The sign-up form calls it before attaching the email.
-- Worst case for abuse: someone cancels another person's never-confirmed sign-up, the same as that
-- person abandoning it (their confirmation link stops working; signing up again sends a new one).
-- It returns only whether it freed the email, which says no more than email_exists already does.
CREATE OR REPLACE FUNCTION public.release_unfinished_signup(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN false;
  END IF;

  DELETE FROM auth.users u
   WHERE lower(u.email) = lower(trim(p_email))
     AND NOT u.is_anonymous
     AND NOT u.is_sso_user
     AND u.email_confirmed_at IS NULL
     AND u.phone_confirmed_at IS NULL
     AND u.last_sign_in_at IS NULL
     AND u.created_at < now() - interval '2 minutes'
     AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.release_unfinished_signup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_unfinished_signup(text) TO anon, authenticated;

-- The guest sign-up signs in anonymously, then attaches the email. When attaching fails (email
-- taken, rate limit), the anonymous login was left behind, empty. This lets that session delete
-- itself: only the caller's own login, only while it's a guest with no email, no pending email and
-- no profile.
CREATE OR REPLACE FUNCTION public.discard_empty_guest()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM auth.users u
   WHERE u.id = auth.uid()
     AND u.is_anonymous
     AND u.email IS NULL
     AND COALESCE(u.email_change, '') = ''
     AND NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = u.id);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.discard_empty_guest() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discard_empty_guest() TO authenticated;
