-- Guest accounts (email-first sign-up in Facebook's browser) keep their typed email as a pending
-- change (auth.users.email_change), so signing in with that email elsewhere used to create a brand
-- new, empty account (2026-11-14: a guest who had connected Messenger and booked a call signed in
-- again by email code and got a second account).
--
-- Now an email code request for such an email goes to the guest account instead:
--   * guest_awaiting_email(email)     — app: is a guest waiting on this email? (same exposure as
--                                       email_exists, which the sign-up form already calls)
--   * set_guest_email_code(email, code) — forgot-password edge fn (service role): stores a fresh code
--                                       as the guest's email-change code; Supabase's own resend
--                                       can't do it for an account with no current email.
-- The app then checks it with verifyOtp type 'email_change', which signs into the guest account and
-- confirms the email (sync_guest_confirmed_email copies it to public.users). Proof of the inbox is
-- still required: nothing is confirmed until the emailed code comes back.
--
-- Also same_email_accounts(user_id) for messenger-stuck-alerts: other accounts with the same email
-- (one of them a guest), so a duplicate isn't reported as "Facebook not confirmed".

CREATE OR REPLACE FUNCTION public.guest_awaiting_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
   SELECT length(trim(coalesce(p_email, ''))) > 3
      AND EXISTS (
         SELECT 1 FROM auth.users g
         WHERE g.is_anonymous
           AND g.deleted_at IS NULL
           AND lower(g.email_change) = lower(trim(p_email))
      )
      AND NOT EXISTS (
         SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(trim(p_email))
      );
$$;

REVOKE ALL ON FUNCTION public.guest_awaiting_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_awaiting_email(text) TO anon, authenticated, service_role;

-- Returns the guest's id and whether a code went out under a minute ago (then nothing changes, so a
-- double tap can't invalidate the code they're about to type). NULL user_id = no guest waiting.
CREATE OR REPLACE FUNCTION public.set_guest_email_code(p_email text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
   v_email text := lower(trim(coalesce(p_email, '')));
   v_user auth.users%ROWTYPE;
   v_hash text;
BEGIN
   IF p_code !~ '^[0-9]{6,10}$' THEN
      RAISE EXCEPTION 'bad code';
   END IF;
   IF NOT public.guest_awaiting_email(v_email) THEN
      RETURN jsonb_build_object('user_id', NULL);
   END IF;

   SELECT * INTO v_user FROM auth.users g
   WHERE g.is_anonymous AND g.deleted_at IS NULL AND lower(g.email_change) = v_email
   ORDER BY g.created_at DESC
   LIMIT 1
   FOR UPDATE;

   IF v_user.email_change_sent_at > now() - interval '60 seconds' AND coalesce(v_user.email_change_token_new, '') <> '' THEN
      RETURN jsonb_build_object('user_id', v_user.id, 'throttled', true);
   END IF;

   -- Same token format Supabase Auth uses: hex sha224 of email + code.
   v_hash := encode(sha224(convert_to(lower(v_user.email_change) || p_code, 'UTF8')), 'hex');

   UPDATE auth.users
   SET email_change_token_new = v_hash,
       email_change_sent_at = now(),
       email_change_confirm_status = 0
   WHERE id = v_user.id;

   DELETE FROM auth.one_time_tokens WHERE user_id = v_user.id AND token_type = 'email_change_token_new';
   INSERT INTO auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to)
   VALUES (gen_random_uuid(), v_user.id, 'email_change_token_new', v_hash, lower(v_user.email_change));

   RETURN jsonb_build_object('user_id', v_user.id, 'throttled', false);
END;
$$;

REVOKE ALL ON FUNCTION public.set_guest_email_code(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_guest_email_code(text, text) TO service_role;

-- Other accounts that share this account's email, where one side is a guest whose typed email it is.
CREATE OR REPLACE FUNCTION public.same_email_accounts(p_user_id uuid)
RETURNS TABLE (id uuid, username text, messenger_verified_at timestamptz, is_guest boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
   WITH me AS (
      SELECT a.id,
             lower(nullif(a.email, '')) AS email,
             lower(nullif(coalesce(nullif(a.email_change, ''), a.raw_user_meta_data->>'guest_email'), '')) AS guest_email
      FROM auth.users a WHERE a.id = p_user_id
   )
   SELECT o.id, pu.username, pu.messenger_verified_at, o.is_anonymous
   FROM me
   JOIN auth.users o ON o.id <> me.id AND o.deleted_at IS NULL AND (
         (me.email IS NOT NULL AND o.is_anonymous AND lower(coalesce(nullif(o.email_change, ''), o.raw_user_meta_data->>'guest_email')) = me.email)
      OR (me.guest_email IS NOT NULL AND lower(o.email) = me.guest_email)
   )
   JOIN public.users pu ON pu.id = o.id
   ORDER BY pu.messenger_verified_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.same_email_accounts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.same_email_accounts(uuid) TO service_role;
