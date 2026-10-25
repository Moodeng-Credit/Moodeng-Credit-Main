-- Indonesia's WhatsApp-first sign-up: once WhatsApp is confirmed, the bot sends the borrower their
-- Facebook code on WhatsApp (sendpulse-messenger-verify). start_contact_verification deletes every
-- unused code before minting a new one, so opening the Facebook step in the app would kill the code
-- they were just sent. The app's Indonesian flow asks for a code through this instead: the newest
-- unused Facebook code that still has a few minutes left, or a fresh one exactly as before.
CREATE OR REPLACE FUNCTION public.start_or_reuse_messenger_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_code TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT code INTO v_code
  FROM public.contact_verification_codes
  WHERE user_id = v_user_id
    AND channel = 'messenger'
    AND verified_at IS NULL
    AND expires_at > now() + interval '5 minutes'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  RETURN public.start_contact_verification('messenger');
END;
$$;

REVOKE ALL ON FUNCTION public.start_or_reuse_messenger_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_or_reuse_messenger_code() FROM anon;
GRANT EXECUTE ON FUNCTION public.start_or_reuse_messenger_code() TO authenticated;
