-- Viber reminders, for borrowers without WhatsApp (George, 2026-10-19).
--
-- Viber's business options all cost €100+/month, so reminders go out from an ordinary Viber account
-- signed in on an Android emulator on George's Mac. A small relay script there (scripts/viber-relay)
-- polls this outbox, types each message into Viber and taps Send, then reports back. Nothing here
-- talks to Viber directly.
--
-- Opt-in: the borrower types their Viber number in the app; we queue a 6-digit code to it; they type
-- the code back in the app (confirm_viber_verification) and viber_number / viber_verified_at are set.
-- The relay never has to read incoming chats.
--
-- Two switches in telegram_bot_settings, both 'false' until the relay is running:
--   borrower_viber_card_enabled  the "Get reminders on Viber" card (get_viber_reminders_enabled)
--   borrower_viber_enabled       queueing due-date reminders (borrowerNotificationDelivery.ts)
-- If the relay stops, the team gets a Telegram alert (private.viber_watchdog, every 5 minutes).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS viber_number TEXT,
  ADD COLUMN IF NOT EXISTS viber_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notif_viber BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.viber_number IS
  'Viber number (digits, E.164 without +) confirmed with a code sent over Viber. Server-only.';
COMMENT ON COLUMN public.users.viber_verified_at IS 'When the Viber code was confirmed. Server-only.';
COMMENT ON COLUMN public.users.notif_viber IS 'Viber reminders opt-out. Their preference, client-writable.';

-- viber_number decides where reminders go, so only server code may set it (like whatsapp_contact_id).
CREATE OR REPLACE FUNCTION public.enforce_viber_server_only()
RETURNS trigger AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN new;
  END IF;

  IF TG_OP = 'INSERT' THEN
    new.viber_number := NULL;
    new.viber_verified_at := NULL;
    RETURN new;
  END IF;

  IF new.viber_number IS DISTINCT FROM old.viber_number OR new.viber_verified_at IS DISTINCT FROM old.viber_verified_at THEN
    RAISE EXCEPTION 'users: viber_number / viber_verified_at can only be written by verified server-side code';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_viber_server_only ON public.users;
CREATE TRIGGER trg_enforce_viber_server_only
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_viber_server_only();

-- Everything the relay sends. Server-only: RLS on, no policies.
CREATE TABLE IF NOT EXISTS public.viber_outbox (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('code', 'reminder', 'test')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
);
ALTER TABLE public.viber_outbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS viber_outbox_queued_idx ON public.viber_outbox (created_at) WHERE status IN ('queued', 'sending');

-- Pending opt-ins: one per user, the latest code wins.
CREATE TABLE IF NOT EXISTS public.viber_verifications (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.viber_verifications ENABLE ROW LEVEL SECURITY;

INSERT INTO public.telegram_bot_settings (key, value) VALUES
  ('borrower_viber_card_enabled', 'false'),
  ('borrower_viber_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_viber_reminders_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value = 'true' FROM public.telegram_bot_settings WHERE key = 'borrower_viber_card_enabled'), false);
$$;
REVOKE ALL ON FUNCTION public.get_viber_reminders_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viber_reminders_enabled() TO authenticated;

-- Borrower: "send my code to this Viber number". Returns 'ok', or 'invalid_number' / 'too_many'.
-- At most 3 codes an hour per borrower, so nobody can use us to spam a number.
CREATE OR REPLACE FUNCTION public.start_viber_verification(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_code TEXT;
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
  IF (SELECT count(*) FROM public.viber_outbox WHERE user_id = v_uid AND kind = 'code' AND created_at > now() - interval '1 hour') >= 3 THEN
    RETURN 'too_many';
  END IF;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  INSERT INTO public.viber_verifications (user_id, phone, code, attempts, expires_at)
  VALUES (v_uid, v_phone, v_code, 0, now() + interval '30 minutes')
  ON CONFLICT (user_id) DO UPDATE SET phone = excluded.phone, code = excluded.code, attempts = 0,
    expires_at = excluded.expires_at, created_at = now();
  INSERT INTO public.viber_outbox (user_id, phone, body, kind)
  VALUES (v_uid, v_phone, 'Your Moodeng Credit code is ' || v_code || '. Type it in the app to get payment reminders here on Viber.', 'code');
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.start_viber_verification(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_viber_verification(TEXT) TO authenticated;

-- Borrower: the code they got on Viber. Returns 'ok', 'wrong_code', 'expired' or 'no_code'.
CREATE OR REPLACE FUNCTION public.confirm_viber_verification(p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.viber_verifications%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  SELECT * INTO v_row FROM public.viber_verifications WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'no_code';
  END IF;
  IF v_row.expires_at < now() OR v_row.attempts >= 5 THEN
    RETURN 'expired';
  END IF;
  IF regexp_replace(COALESCE(p_code, ''), '\D', '', 'g') <> v_row.code THEN
    UPDATE public.viber_verifications SET attempts = attempts + 1 WHERE user_id = v_uid;
    RETURN 'wrong_code';
  END IF;

  UPDATE public.users SET viber_number = v_row.phone, viber_verified_at = now(), notif_viber = true WHERE id = v_uid;
  DELETE FROM public.viber_verifications WHERE user_id = v_uid;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_viber_verification(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_viber_verification(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------------------------------
-- The relay (scripts/viber-relay on George's Mac). It holds only VIBER_RELAY_TOKEN (Vault), which
-- these two functions check; no service key leaves the server.

CREATE OR REPLACE FUNCTION private.viber_relay_token_ok(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(length(p_token) >= 32 AND p_token = (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'VIBER_RELAY_TOKEN' LIMIT 1), false);
$$;
REVOKE EXECUTE ON FUNCTION private.viber_relay_token_ok(TEXT) FROM public, anon, authenticated;

-- Hands the relay up to p_limit messages, oldest first, and records that it's alive. A message
-- claimed but not reported within 10 minutes (relay crashed mid-send) goes back in the queue.
CREATE OR REPLACE FUNCTION public.viber_relay_claim(p_token TEXT, p_limit INT DEFAULT 5)
RETURNS TABLE (id BIGINT, phone TEXT, body TEXT, kind TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT private.viber_relay_token_ok(p_token) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.telegram_bot_settings (key, value) VALUES ('viber_relay_last_seen', now()::text)
  ON CONFLICT (key) DO UPDATE SET value = excluded.value;

  UPDATE public.viber_outbox o SET status = 'queued'
  WHERE o.status = 'sending' AND o.claimed_at < now() - interval '10 minutes';

  RETURN QUERY
  UPDATE public.viber_outbox o SET status = 'sending', claimed_at = now(), attempts = o.attempts + 1
  WHERE o.id IN (
    SELECT q.id FROM public.viber_outbox q
    WHERE q.status = 'queued'
    ORDER BY (q.kind = 'code') DESC, q.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 20)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING o.id, o.phone, o.body, o.kind;
END;
$$;
REVOKE ALL ON FUNCTION public.viber_relay_claim(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viber_relay_claim(TEXT, INT) TO anon;

-- The relay's result for one message. A failure is retried up to 3 attempts, then left 'failed'.
CREATE OR REPLACE FUNCTION public.viber_relay_report(p_token TEXT, p_id BIGINT, p_ok BOOLEAN, p_error TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT private.viber_relay_token_ok(p_token) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.viber_outbox o SET
    status = CASE WHEN p_ok THEN 'sent' WHEN o.attempts >= 3 THEN 'failed' ELSE 'queued' END,
    sent_at = CASE WHEN p_ok THEN now() ELSE o.sent_at END,
    error = CASE WHEN p_ok THEN NULL ELSE left(p_error, 500) END
  WHERE o.id = p_id AND o.status = 'sending';
END;
$$;
REVOKE ALL ON FUNCTION public.viber_relay_report(TEXT, BIGINT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viber_relay_report(TEXT, BIGINT, BOOLEAN, TEXT) TO anon;

-- ---------------------------------------------------------------------------------------------------
-- Watchdog: tell the team (Telegram group) when Viber messages are stuck or failed, at most once an
-- hour per kind, so nobody silently misses a reminder.

CREATE TABLE IF NOT EXISTS private.viber_alerts (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION private.viber_watchdog()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stuck INT;
  v_failed INT;
  v_last_seen TEXT;
  v_msg TEXT;
  v_kind TEXT;
  v_token TEXT;
  v_chat TEXT;
BEGIN
  SELECT count(*) INTO v_stuck FROM public.viber_outbox WHERE status IN ('queued', 'sending') AND created_at < now() - interval '10 minutes';
  SELECT count(*) INTO v_failed FROM public.viber_outbox WHERE status = 'failed' AND created_at > now() - interval '1 hour';
  SELECT value INTO v_last_seen FROM public.telegram_bot_settings WHERE key = 'viber_relay_last_seen';

  IF v_stuck > 0 THEN
    v_kind := 'stuck';
    v_msg := v_stuck || ' Viber message(s) waiting over 10 min. The relay on George''s Mac looks down (last seen '
      || COALESCE(to_char(v_last_seen::timestamptz AT TIME ZONE 'Asia/Bangkok', 'DD Mon HH24:MI') || ' Bangkok', 'never')
      || '). Check the emulator and run scripts/viber-relay.';
  ELSIF v_failed > 0 THEN
    v_kind := 'failed';
    v_msg := v_failed || ' Viber message(s) failed 3 times in the last hour (number not on Viber, or the relay can''t tap Send). See viber_outbox.error.';
  ELSE
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM private.viber_alerts WHERE kind = v_kind AND created_at > now() - interval '1 hour') THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'TELEGRAM_API_TOKEN' LIMIT 1;
  SELECT value INTO v_chat FROM public.telegram_bot_settings WHERE key = 'team_group_chat_id' LIMIT 1;
  IF nullif(trim(v_token), '') IS NOT NULL AND nullif(trim(v_chat), '') IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://api.telegram.org/bot' || trim(v_token) || '/sendMessage',
      body := jsonb_build_object('chat_id', trim(v_chat), 'text', '💜 Viber reminders: ' || v_msg),
      headers := jsonb_build_object('Content-Type', 'application/json'));
  END IF;
  INSERT INTO private.viber_alerts (kind, message) VALUES (v_kind, v_msg);
END;
$$;
REVOKE EXECUTE ON FUNCTION private.viber_watchdog() FROM public, anon, authenticated;

SELECT cron.unschedule('viber-watchdog') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'viber-watchdog');
SELECT cron.schedule('viber-watchdog', '*/5 * * * *', $$SELECT private.viber_watchdog()$$);
