-- Desktop Messenger QR → phone hand-off page (moodeng.app/fb/<code>, MessengerHandoff).
--
-- On Android the hand-off page opens our chat without the code (Messenger refuses links that carry
-- it), just like the in-app Android button. The in-app button stamps chat_opened_at through
-- mark_messenger_chat_opened(), so sendpulse-events can connect the borrower by timing when they only
-- say hi. The hand-off page has no sign-in, so it stamps by the code instead: the code is already the
-- key (sending it to the Page by hand verifies the account), so this grants nothing new.
--
-- Guessing: codes are MDNG- + 6 hex characters. Every miss is logged, and more than 20 misses in
-- 10 minutes (from anyone) stops all stamping until they age out, so live codes can't be hunted.
-- Returns nothing either way, so a call never says whether a code exists.

CREATE TABLE IF NOT EXISTS public.messenger_handoff_attempts (
   id BIGSERIAL PRIMARY KEY,
   attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
   ok BOOLEAN NOT NULL
);
CREATE INDEX IF NOT EXISTS messenger_handoff_attempts_at_idx ON public.messenger_handoff_attempts (attempted_at DESC);
ALTER TABLE public.messenger_handoff_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messenger_handoff_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.mark_messenger_chat_opened_by_code(p_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
   v_misses INT;
   v_id UUID;
BEGIN
   IF p_code IS NULL OR upper(p_code) !~ '^MDNG-[A-Z0-9]{4,12}$' THEN
      RETURN;
   END IF;

   SELECT count(*) INTO v_misses
     FROM public.messenger_handoff_attempts
    WHERE NOT ok AND attempted_at > now() - interval '10 minutes';
   IF v_misses > 20 THEN
      RETURN;
   END IF;

   SELECT id INTO v_id
     FROM public.contact_verification_codes
    WHERE code = upper(p_code)
      AND channel = 'messenger'
      AND verified_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;

   INSERT INTO public.messenger_handoff_attempts (ok) VALUES (v_id IS NOT NULL);
   IF v_id IS NOT NULL THEN
      UPDATE public.contact_verification_codes SET chat_opened_at = now() WHERE id = v_id;
   END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messenger_chat_opened_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messenger_chat_opened_by_code(TEXT) TO anon, authenticated;
