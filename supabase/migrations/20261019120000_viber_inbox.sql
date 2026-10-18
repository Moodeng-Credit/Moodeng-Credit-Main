-- Viber replies → team Telegram (George, 2026-10-19).
--
-- Replies to our Viber messages land on the emulator, where nobody sees them. The relay saves every
-- borrower it messages as a phone contact named "MDNG +<number>", so Viber's new-message notifications
-- for borrower chats carry the number; it reads those (and only those: George's own chats are on the
-- same account) and hands each one to viber_relay_inbound, which keeps a copy and posts it to the team
-- Telegram group.

CREATE TABLE IF NOT EXISTS public.viber_inbox (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  body TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.viber_inbox ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS viber_inbox_phone_idx ON public.viber_inbox (phone, received_at DESC);

CREATE OR REPLACE FUNCTION public.viber_relay_inbound(p_token TEXT, p_phone TEXT, p_body TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_body TEXT := left(trim(COALESCE(p_body, '')), 2000);
  v_uid UUID;
  v_name TEXT;
BEGIN
  IF NOT private.viber_relay_token_ok(p_token) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF v_phone = '' OR v_body = '' THEN
    RETURN;
  END IF;
  -- The relay may see the same notification twice (it reads them every 20 s): skip exact repeats
  -- from the last 10 minutes.
  IF EXISTS (SELECT 1 FROM public.viber_inbox WHERE phone = v_phone AND body = v_body AND received_at > now() - interval '10 minutes') THEN
    RETURN;
  END IF;

  SELECT id, COALESCE(NULLIF(trim(username), ''), email) INTO v_uid, v_name
  FROM public.users WHERE viber_number = v_phone ORDER BY viber_verified_at DESC NULLS LAST LIMIT 1;

  INSERT INTO public.viber_inbox (user_id, phone, body) VALUES (v_uid, v_phone, v_body);
  PERFORM private.viber_team_post(
    '💬 Viber from ' || COALESCE(v_name, 'unknown borrower') || ' (+' || v_phone || '):' || E'\n' || v_body
      || E'\n\n' || 'Reply in Viber on the Mac emulator, or on Messenger.');
END;
$$;
REVOKE ALL ON FUNCTION public.viber_relay_inbound(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viber_relay_inbound(TEXT, TEXT, TEXT) TO anon;
