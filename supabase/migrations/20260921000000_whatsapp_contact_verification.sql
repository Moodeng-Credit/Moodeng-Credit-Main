-- WhatsApp contact verification for the end-of-application "how we reach you" step.
--
-- Borrowers give a WhatsApp (verified) and/or a Facebook (collected only, no verification) so
-- Moodeng can contact them later — mostly withdrawal help, and loan extensions. WhatsApp is the
-- one that matters for "can we actually reach this person," so it gets a real proof-of-ownership
-- step: the borrower taps a link that opens WhatsApp with a one-time code pre-filled, sends it
-- with no typing, and the whatsapp-webhook edge function matches the code against this table and
-- flips users.whatsapp_verified_at — capturing the sender's real wa_id as users.whatsapp_number
-- in the same write, so there's no manual-entry typo between "what they typed" and "what we can
-- actually message."
--
-- Facebook is unverified and lives directly on users.facebook_contact — it's a fallback contact
-- channel, not a proof of identity, so it doesn't need this table's code/expiry machinery.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS facebook_contact TEXT;

COMMENT ON COLUMN public.users.whatsapp_number IS
  'E.164-ish sender wa_id captured from the verification webhook, not user-typed — set only once whatsapp_verified_at is set.';
COMMENT ON COLUMN public.users.whatsapp_verified_at IS
  'When the borrower proved control of whatsapp_number by sending back their one-time code. NULL = not verified.';
COMMENT ON COLUMN public.users.facebook_contact IS
  'Facebook profile link or handle the borrower typed at the end of their loan application. Collected only, never verified, never shown to lenders.';

CREATE TABLE IF NOT EXISTS public.contact_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel = 'whatsapp'),
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  verified_at TIMESTAMPTZ,
  sender_wa_id TEXT
);

-- One live (unverified, unexpired) code per user at a time — starting a new attempt should
-- replace the old code, not accumulate rows an old wa.me link could still redeem.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_verification_codes_active_per_user
  ON public.contact_verification_codes (user_id)
  WHERE verified_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contact_verification_codes_code
  ON public.contact_verification_codes (code)
  WHERE verified_at IS NULL;

ALTER TABLE public.contact_verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own verification codes" ON public.contact_verification_codes;
CREATE POLICY "Users read their own verification codes"
  ON public.contact_verification_codes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Inserts/updates go through the SECURITY DEFINER RPC below and the service-role webhook, not
-- direct client writes — the webhook is unauthenticated (it's Meta calling us), so it must use
-- the service role, and a client-writable verified_at would let anyone self-verify.
DROP POLICY IF EXISTS "Service role manages verification codes" ON public.contact_verification_codes;
CREATE POLICY "Service role manages verification codes"
  ON public.contact_verification_codes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Starts (or restarts) a WhatsApp verification attempt for the calling user and returns the
-- one-time code to embed in the wa.me pre-filled message. SECURITY DEFINER so it can write a row
-- the RLS policy above otherwise reserves for the service role.
CREATE OR REPLACE FUNCTION public.start_whatsapp_verification()
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

  -- Short, WhatsApp-typo-proof: uppercase hex, no 0/O or 1/I ambiguity to worry about since it's
  -- never hand-typed — the borrower only ever taps the pre-filled wa.me link.
  v_code := 'MDNG-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  -- Replace any still-open attempt for this user rather than stacking rows.
  DELETE FROM public.contact_verification_codes
  WHERE user_id = v_user_id AND verified_at IS NULL;

  INSERT INTO public.contact_verification_codes (user_id, code)
  VALUES (v_user_id, v_code);

  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.start_whatsapp_verification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_whatsapp_verification() FROM anon;
GRANT EXECUTE ON FUNCTION public.start_whatsapp_verification() TO authenticated;
