-- Forgot-password asked email_exists, which only looks at public.users. Some real sign-ins have no
-- profile row (8 on 2026-10-10), so they were told "No Moodeng account uses <email>" and couldn't
-- reset their password. This checks the login itself (auth.users), case-insensitively. Same
-- disclosure as email_exists (whether an address has an account), kept separate so sign-up and
-- sign-in behave exactly as before.
CREATE OR REPLACE FUNCTION public.auth_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(trim(p_email)))
      OR EXISTS (SELECT 1 FROM public.users WHERE lower(email) = lower(trim(p_email)));
$$;

REVOKE ALL ON FUNCTION public.auth_email_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_email_exists(text) TO anon, authenticated;
