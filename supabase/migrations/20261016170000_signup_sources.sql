-- Sign-up tags: which browser/app and phone OS someone signed up from, next to the existing
-- signup_source / signup_referrer (where they came from). Saved once, by the app, right after the
-- account is created. The sign-up method (Google, email code, guest, password, Telegram…) is read
-- from Supabase Auth when needed, so it's never out of date.
--
-- Admin tab "Sign-up sources" reads admin_signup_sources(): one row per account created in the last
-- p_days, with its tags and how far it got (Facebook connected → approved → ID verified → borrowed).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signup_browser text,
  ADD COLUMN IF NOT EXISTS signup_os text;

-- Called once per account by the app. Only fills empty tags, only for accounts made in the last 2 days
-- (an old account opened in a new browser is not a sign-up).
CREATE OR REPLACE FUNCTION public.record_signup_context(p_browser text, p_os text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.users
     SET signup_browser = left(nullif(trim(p_browser), ''), 40),
         signup_os = left(nullif(trim(p_os), ''), 20)
   WHERE id = auth.uid()
     AND signup_browser IS NULL
     AND created_at > now() - interval '2 days';
$$;

REVOKE ALL ON FUNCTION public.record_signup_context(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_signup_context(text, text) TO authenticated;

-- How the account was created, from Supabase Auth.
CREATE OR REPLACE FUNCTION app_private.signup_method(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
           WHEN a.is_anonymous OR a.raw_user_meta_data ? 'guest_email' THEN 'Email (no code)'
           WHEN a.raw_app_meta_data ->> 'provider' = 'google' THEN 'Google'
           WHEN a.raw_app_meta_data ->> 'provider' = 'facebook' THEN 'Facebook'
           WHEN a.raw_app_meta_data ->> 'provider' = 'phone' OR a.email LIKE 'phone\_%' THEN 'Phone code'
           WHEN a.email LIKE 'telegram\_%' THEN 'Telegram'
           WHEN a.email LIKE 'line\_%' THEN 'LINE'
           WHEN a.raw_user_meta_data ->> 'passwordless' = 'true' THEN 'Email code'
           WHEN a.raw_app_meta_data ->> 'provider' = 'email' THEN 'Email + password'
           ELSE coalesce(a.raw_app_meta_data ->> 'provider', 'Unknown')
         END
    FROM auth.users a
   WHERE a.id = p_user_id;
$$;

REVOKE ALL ON FUNCTION app_private.signup_method(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_signup_sources(p_days integer DEFAULT 30)
RETURNS TABLE (
  id uuid,
  username text,
  created_at timestamptz,
  method text,
  browser text,
  os text,
  source text,
  referrer text,
  campaign text,
  facebook_connected boolean,
  approved boolean,
  id_verified boolean,
  borrowed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT app_private.is_moodeng_admin() THEN
    RAISE EXCEPTION 'admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id,
         u.username,
         u.created_at,
         app_private.signup_method(u.id),
         u.signup_browser,
         u.signup_os,
         u.signup_source,
         u.signup_referrer,
         u.signup_campaign,
         u.messenger_verified_at IS NOT NULL,
         u.loan_access_status = 'approved',
         (u.is_didit = 'ACTIVE' OR u.is_world_id = 'ACTIVE' OR (to_jsonb(u) ->> 'is_world_id_passport') = 'ACTIVE'),
         EXISTS (SELECT 1 FROM public.loans l WHERE l.borrower_user_id = u.id AND l.funded_at IS NOT NULL)
    FROM public.users u
   WHERE u.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)))
   ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_signup_sources(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_signup_sources(integer) TO authenticated;
