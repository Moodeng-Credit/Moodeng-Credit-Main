-- Facebook Messenger contact verification — the verified *second* channel for the loan-application
-- "how we reach you" step, alongside WhatsApp.
--
-- Same proof-of-contact shape as WhatsApp, so either one gives Moodeng a real line back:
--   * borrower opens m.me/<page>?ref=MDNG-XXXXXX (the code comes from start_contact_verification),
--   * Messenger delivers a referral/postback event to the messenger-webhook edge function,
--   * the webhook matches the code and stamps users.messenger_verified_at plus the sender's
--     Page-scoped ID (PSID) — the id Moodeng actually messages them on, never something typed.
--
-- This replaces the old unverified, free-text users.facebook_contact as the "Facebook option":
-- a typed handle proves nothing and gives no line back; a captured PSID does. facebook_contact is
-- left in place (harmless) but is no longer what the contacts step relies on.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS messenger_psid TEXT,
  ADD COLUMN IF NOT EXISTS messenger_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.messenger_psid IS
  'Page-scoped ID (PSID) captured from the Messenger referral webhook, not user-typed — set only once messenger_verified_at is set. The id Moodeng messages the borrower back on.';
COMMENT ON COLUMN public.users.messenger_verified_at IS
  'When the borrower proved a Messenger line by opening the m.me code link and starting the thread with the Page. NULL = not verified.';

-- contact_verification_codes was WhatsApp-only (channel CHECK = 'whatsapp'); widen it to messenger
-- and record the Messenger sender id alongside the existing WhatsApp one.
ALTER TABLE public.contact_verification_codes
  ADD COLUMN IF NOT EXISTS sender_psid TEXT;

ALTER TABLE public.contact_verification_codes
  DROP CONSTRAINT IF EXISTS contact_verification_codes_channel_check;
ALTER TABLE public.contact_verification_codes
  ADD CONSTRAINT contact_verification_codes_channel_check CHECK (channel IN ('whatsapp', 'messenger'));

-- The old "one live code per user" index was global; a borrower can now legitimately have one
-- open WhatsApp attempt and one open Messenger attempt at the same time, so scope uniqueness to
-- (user_id, channel).
DROP INDEX IF EXISTS idx_contact_verification_codes_active_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_verification_codes_active_per_user_channel
  ON public.contact_verification_codes (user_id, channel)
  WHERE verified_at IS NULL;

-- Generic starter: begins (or restarts) a verification attempt for the calling user on a given
-- channel and returns the one-time code to embed in the wa.me / m.me link. SECURITY DEFINER so it
-- can write a row RLS otherwise reserves for the service role. Replaces any still-open attempt for
-- that user *on that channel only*, so starting one channel never wipes the other's pending code.
CREATE OR REPLACE FUNCTION public.start_contact_verification(p_channel TEXT DEFAULT 'whatsapp')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_channel NOT IN ('whatsapp', 'messenger') THEN
    RAISE EXCEPTION 'Unsupported verification channel: %', p_channel;
  END IF;

  -- Short, typo-proof code. Never hand-typed — the borrower only ever taps the pre-filled link —
  -- so the exact alphabet doesn't matter, only that it round-trips through Meta unchanged.
  v_code := 'MDNG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  DELETE FROM public.contact_verification_codes
  WHERE user_id = v_user_id AND channel = p_channel AND verified_at IS NULL;

  INSERT INTO public.contact_verification_codes (user_id, channel, code)
  VALUES (v_user_id, p_channel, v_code);

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.start_contact_verification(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_contact_verification(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_contact_verification(TEXT) TO authenticated;

-- Keep the original WhatsApp entry point working (the deployed frontend still calls it) but route
-- it through the generic function so the per-channel delete scoping above applies to it too.
CREATE OR REPLACE FUNCTION public.start_whatsapp_verification()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.start_contact_verification('whatsapp');
END;
$$;

REVOKE ALL ON FUNCTION public.start_whatsapp_verification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_whatsapp_verification() FROM anon;
GRANT EXECUTE ON FUNCTION public.start_whatsapp_verification() TO authenticated;
