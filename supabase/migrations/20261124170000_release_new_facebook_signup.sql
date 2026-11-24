-- "Have you used Moodeng before?" → yes, after a Facebook login made a NEW account (#1767).
--
-- Supabase only auto-links Facebook into an existing account when the emails match, so a returning
-- borrower whose Facebook has another email (or none) gets a brand-new, empty account. They log out
-- and sign in the old way — but that empty account still owns their Facebook identity, so the
-- dashboard's "Connect Facebook" card (supabase.auth.linkIdentity) would be refused with
-- "Identity is already linked to another user".
--
-- release_new_facebook_signup() lets the signed-in person give that Facebook back, only when the
-- account is clearly the empty one Facebook just made:
--   * created in the last 24 hours;
--   * every identity on it is Facebook (no phone/email/Google they could still be using);
--   * no loan as borrower or lender, no wallet, no ID check started.
-- It deletes the Facebook identity rows and the account's sessions (they are logging out anyway).
-- The empty account stays (with its device/IP signals for the linked-accounts check) but can no
-- longer be signed into. Nothing is deleted from public tables.
CREATE OR REPLACE FUNCTION public.release_new_facebook_signup()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_created TIMESTAMPTZ;
  v_fb INT;
  v_other INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 'kept:not_signed_in';
  END IF;

  SELECT created_at INTO v_created FROM auth.users WHERE id = v_uid;
  IF v_created IS NULL OR v_created < now() - interval '24 hours' THEN
    RETURN 'kept:not_new';
  END IF;

  SELECT count(*) FILTER (WHERE provider = 'facebook'), count(*) FILTER (WHERE provider <> 'facebook')
    INTO v_fb, v_other
    FROM auth.identities WHERE user_id = v_uid;
  IF v_fb = 0 THEN
    RETURN 'kept:no_facebook';
  END IF;
  IF v_other > 0 THEN
    RETURN 'kept:other_login';
  END IF;

  IF EXISTS (SELECT 1 FROM public.loans WHERE borrower_user_id = v_uid OR lender_user_id = v_uid) THEN
    RETURN 'kept:has_loans';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users
     WHERE id = v_uid
       AND (wallet_address IS NOT NULL OR didit_id_status IS NOT NULL)
  ) OR EXISTS (SELECT 1 FROM public.embedded_wallet_grants WHERE user_id = v_uid) THEN
    RETURN 'kept:in_use';
  END IF;

  DELETE FROM auth.identities WHERE user_id = v_uid AND provider = 'facebook';
  DELETE FROM auth.sessions WHERE user_id = v_uid;
  RAISE LOG 'release_new_facebook_signup: released facebook identity of new account %', v_uid;
  RETURN 'released';
END;
$$;

REVOKE ALL ON FUNCTION public.release_new_facebook_signup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_new_facebook_signup() TO authenticated;

COMMENT ON FUNCTION public.release_new_facebook_signup() IS
  'Returning borrower said "used Moodeng before" after Facebook made a new empty account: frees that Facebook so it can be connected to their real account. See 20261124170000.';
