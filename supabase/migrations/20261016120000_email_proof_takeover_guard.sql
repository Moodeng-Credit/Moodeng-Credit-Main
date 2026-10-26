-- Pre-account-takeover guard for when "Confirm email" is switched OFF (docs/FB_BROWSER_AUTH_PLAN.md, A1–A3).
--
-- The attack: with Confirm email off, Supabase marks a new email+password account as confirmed the
-- moment it's created, without anyone proving they own the inbox. Someone can sign up with
-- victim@gmail.com and a password of their choosing. When the real owner later taps "Sign in with
-- Google", Supabase auto-links Google into that existing account (same email), and the attacker's
-- password still opens it. Supabase's own defence (RemoveUnconfirmedIdentities in
-- internal/api/external.go) only runs when the user is NOT confirmed, so with auto-confirm it never fires.
--
-- The fix, in three parts:
--   A1  auth_email_proof — one row per account whose email was auto-confirmed at sign-up (nobody read
--       a link or code from that inbox). No row, or a resolved row, means the email is proven.
--       email_proven(user_id) is the read helper for later features (e.g. only sending loan emails to
--       proven addresses).
--   A2  When an OAuth identity (Google, Facebook, …) is linked to an account that still has an
--       unproven row, the provider has just vouched for the email, so whoever set the password may not
--       be the owner: wipe the password and delete the account's existing sessions, then resolve the
--       row. This runs inside GoTrue's linking transaction (atomic, no client involvement). GoTrue
--       issues the new OAuth session AFTER the identity insert in the same transaction and only ever
--       UpdateOnly()s specific columns (raw_user_meta_data / raw_app_meta_data / last_sign_in_at)
--       there, so neither the password wipe nor the new session is overwritten.
--   A3  The reset-password edge function resolves the row once the person proves the inbox with a
--       recovery code (see that function). GoTrue already logs out every session when the password is
--       set through the admin API.
--
-- While Confirm email is ON (the setting as of 2026-10-16), new email sign-ups are inserted with
-- email_confirmed_at NULL, so nothing is recorded and Supabase's own defence applies. The guard only
-- does work once auto-confirm is switched on again.

-- A1 ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_email_proof (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  unproven_since TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  -- 'oauth_link:<provider>' (A2 — password wiped, sessions revoked) or 'password_reset' (A3).
  resolved_by TEXT
);

COMMENT ON TABLE public.auth_email_proof IS
  'Accounts whose email was auto-confirmed at sign-up (Confirm email OFF). Unresolved row = email not proven. See 20261016120000.';

ALTER TABLE public.auth_email_proof ENABLE ROW LEVEL SECURITY;
-- No policies: only service role and the SECURITY DEFINER functions below touch it.
REVOKE ALL ON TABLE public.auth_email_proof FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_proven(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.auth_email_proof WHERE user_id = p_user_id AND resolved_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.email_proven(UUID) FROM PUBLIC, anon, authenticated;

-- Records auto-confirmed email+password sign-ups. Skips:
--   * accounts created unconfirmed (Confirm email ON) — the person proves the inbox by confirming;
--   * OAuth / phone sign-ups (provider <> 'email');
--   * the synthetic addresses telegram-login / line-login create through the admin API — no OAuth
--     provider can ever link to them, so there is nothing to guard.
-- Never blocks a sign-up: a failure here is logged and swallowed.
CREATE OR REPLACE FUNCTION public.record_unproven_email_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL
     AND new.email IS NOT NULL
     AND COALESCE(new.raw_app_meta_data ->> 'provider', 'email') = 'email'
     AND COALESCE(new.encrypted_password, '') <> ''
     AND split_part(lower(new.email), '@', 2) NOT IN ('moodeng.app', 'moodeng.credit')
  THEN
    BEGIN
      INSERT INTO public.auth_email_proof (user_id) VALUES (new.id) ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'record_unproven_email_signup failed for %: %', new.id, SQLERRM;
    END;
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_record_unproven_email ON auth.users;
CREATE TRIGGER on_auth_user_created_record_unproven_email
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_unproven_email_signup();

-- A2 ---------------------------------------------------------------------------------------------
-- Fails closed on purpose: if the lock-out can't run, the OAuth link (and that one login) fails rather
-- than handing the account to a provider-verified owner while a stranger's password still works. It
-- only ever runs for accounts with an unresolved auth_email_proof row.
CREATE OR REPLACE FUNCTION public.lock_out_unproven_password_on_oauth_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.provider IN ('email', 'phone', 'anonymous') THEN
    RETURN new;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.auth_email_proof WHERE user_id = new.user_id AND resolved_at IS NULL
  ) THEN
    RETURN new;
  END IF;

  -- An empty hash makes GoTrue's User.Authenticate return false for every password.
  UPDATE auth.users SET encrypted_password = '' WHERE id = new.user_id;
  -- Same statement GoTrue's own models.Logout runs; refresh tokens go with their sessions. The new
  -- OAuth session is created after this, in the same transaction, so it survives.
  DELETE FROM auth.sessions WHERE user_id = new.user_id;

  UPDATE public.auth_email_proof
     SET resolved_at = now(), resolved_by = 'oauth_link:' || new.provider
   WHERE user_id = new.user_id AND resolved_at IS NULL;

  RAISE LOG 'auth_email_proof: wiped unproven password for % on % link', new.user_id, new.provider;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_identity_linked_lock_out_unproven ON auth.identities;
CREATE TRIGGER on_auth_identity_linked_lock_out_unproven
  AFTER INSERT ON auth.identities
  FOR EACH ROW EXECUTE FUNCTION public.lock_out_unproven_password_on_oauth_link();

REVOKE ALL ON FUNCTION public.record_unproven_email_signup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lock_out_unproven_password_on_oauth_link() FROM PUBLIC, anon, authenticated;
