-- Viber reminders without depending on the relay (George, 2026-10-19).
--
-- The relay (scripts/viber-relay, an Android emulator on a Mac) may not be on all the time, so:
--   * Opt-in is just the number: set_my_viber_number() saves it and tells the team on Telegram. No code
--     to confirm (the code had to come from the relay). A welcome message is queued so a wrong number
--     or one not on Viber shows up.
--   * Anything still unsent after 10 minutes (relay off) or failed is handed to the team in one Telegram
--     message: who, which number, what to send. Those rows become 'manual', so the relay never sends
--     them later as a duplicate.
-- When the relay is on, it sends within a minute and the team only hears about opt-ins.

ALTER TABLE public.viber_outbox DROP CONSTRAINT IF EXISTS viber_outbox_kind_check;
ALTER TABLE public.viber_outbox ADD CONSTRAINT viber_outbox_kind_check CHECK (kind IN ('code', 'welcome', 'reminder', 'test'));
ALTER TABLE public.viber_outbox DROP CONSTRAINT IF EXISTS viber_outbox_status_check;
ALTER TABLE public.viber_outbox ADD CONSTRAINT viber_outbox_status_check CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'manual'));

-- The code flow is replaced by set_my_viber_number.
DROP FUNCTION IF EXISTS public.start_viber_verification(TEXT);
DROP FUNCTION IF EXISTS public.confirm_viber_verification(TEXT);
DROP TABLE IF EXISTS public.viber_verifications;

-- Posts to the team Telegram group (same place as the SMS and sign-in alerts).
CREATE OR REPLACE FUNCTION private.viber_team_post(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token TEXT;
  v_chat TEXT;
BEGIN
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'TELEGRAM_API_TOKEN' LIMIT 1;
  SELECT value INTO v_chat FROM public.telegram_bot_settings WHERE key = 'team_group_chat_id' LIMIT 1;
  IF nullif(trim(v_token), '') IS NULL OR nullif(trim(v_chat), '') IS NULL THEN
    RETURN false;
  END IF;
  PERFORM net.http_post(
    url := 'https://api.telegram.org/bot' || trim(v_token) || '/sendMessage',
    body := jsonb_build_object('chat_id', trim(v_chat), 'text', left(p_text, 3900), 'disable_web_page_preview', true),
    headers := jsonb_build_object('Content-Type', 'application/json'));
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.viber_team_post(TEXT) FROM public, anon, authenticated;

-- Borrower: "remind me on Viber at this number". Returns 'ok' or 'invalid_number'.
CREATE OR REPLACE FUNCTION public.set_my_viber_number(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  -- Local Philippine (09…) and Thai (0…) numbers: assume the country from the leading 0.
  IF v_phone ~ '^09\d{9}$' THEN
    v_phone := '63' || substr(v_phone, 2);
  ELSIF v_phone ~ '^0[689]\d{8}$' THEN
    v_phone := '66' || substr(v_phone, 2);
  END IF;
  IF length(v_phone) < 8 OR length(v_phone) > 15 OR v_phone ~ '^0' THEN
    RETURN 'invalid_number';
  END IF;

  -- Same number again: nothing to do (no second welcome or team message).
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND viber_number = v_phone AND notif_viber) THEN
    RETURN 'ok';
  END IF;

  UPDATE public.users SET viber_number = v_phone, viber_verified_at = now(), notif_viber = true
  WHERE id = v_uid
  RETURNING COALESCE(NULLIF(trim(username), ''), email, id::text) INTO v_name;

  INSERT INTO public.viber_outbox (user_id, phone, body, kind)
  VALUES (v_uid, v_phone, 'Hi! This is Moodeng Credit. We''ll send your payment reminders here on Viber. Questions? Just reply.', 'welcome');

  PERFORM private.viber_team_post('💜 ' || v_name || ' turned on Viber reminders: +' || v_phone);
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_viber_number(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_viber_number(TEXT) TO authenticated;

-- Every 5 minutes: hand anything unsent for 10+ minutes, or failed, to the team in one message.
CREATE OR REPLACE FUNCTION private.viber_watchdog()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ids BIGINT[];
  v_text TEXT;
BEGIN
  WITH handed AS (
    UPDATE public.viber_outbox o SET status = 'manual'
    WHERE o.status = 'failed'
       OR (o.status = 'queued' AND o.created_at < now() - interval '10 minutes')
       OR (o.status = 'sending' AND o.claimed_at < now() - interval '10 minutes')
    RETURNING o.id, o.user_id, o.phone, o.body, o.kind, o.error
  )
  SELECT array_agg(h.id ORDER BY h.id),
         string_agg(
           '• ' || COALESCE(NULLIF(trim(u.username), ''), u.email, 'borrower') || '  +' || h.phone
             || CASE h.kind WHEN 'welcome' THEN ' (just turned on Viber)' ELSE '' END
             || CASE WHEN h.error IS NOT NULL THEN ' ⚠️ relay: ' || h.error ELSE '' END
             || E'\n' || h.body,
           E'\n\n' ORDER BY h.id)
  INTO v_ids, v_text
  FROM handed h LEFT JOIN public.users u ON u.id = h.user_id;

  IF v_ids IS NULL THEN
    RETURN;
  END IF;

  PERFORM private.viber_team_post(
    '💜 Send on Viber by hand (' || array_length(v_ids, 1) || '), the relay didn''t:' || E'\n\n' || v_text);
  INSERT INTO private.viber_alerts (kind, message) VALUES ('manual', left(v_text, 2000));
END;
$$;
REVOKE EXECUTE ON FUNCTION private.viber_watchdog() FROM public, anon, authenticated;
