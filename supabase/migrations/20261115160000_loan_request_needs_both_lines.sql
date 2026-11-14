-- Every new loan request needs both contact lines on the account (George, 2026-11-15):
--   * Messenger with its ID (messenger_psid). They sent the code, so we can message them. A
--     messenger_verified_at stamp alone, from a hand /confirm, doesn't count.
--   * A confirmed WhatsApp (whatsapp_verified_at).
--
-- The app's ContactsStep (requireAllLines) asks for whichever is missing before the request goes
-- out. This trigger is the backstop for anything that skips the app's step.
--
-- Left out:
--   * the Indonesia track (its own Telegram/WhatsApp onboarding; bot loans run as service role anyway)
--   * the two accounts the app already exempts from the contact step (Belle's, CONTACT_STEP_EXEMPT_USER_IDS)
--   * WhatsApp while the borrower WhatsApp card is switched off (get_whatsapp_reminders_enabled()),
--     since there would be no way to add it
-- Not SECURITY DEFINER: current_user must stay the caller's role (the borrower can read their own row).
CREATE OR REPLACE FUNCTION private.enforce_loan_request_contact_lines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  u record;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR new.borrower_user_id IS NULL THEN
    RETURN new;
  END IF;
  IF new.borrower_user_id IN ('28cd3b3e-a975-48ab-9db3-a23f74c01d42'::uuid, 'a629dfa3-ebe0-4365-b267-294b19a6ead1'::uuid) THEN
    RETURN new;
  END IF;
  IF coalesce(new.market, '') = 'ID' THEN
    RETURN new;
  END IF;

  SELECT messenger_psid, messenger_verified_at, whatsapp_verified_at, market
    INTO u
    FROM public.users WHERE id = new.borrower_user_id;
  IF NOT FOUND OR coalesce(u.market, '') = 'ID' THEN
    RETURN new;
  END IF;

  IF u.messenger_psid IS NULL OR u.messenger_verified_at IS NULL THEN
    RAISE EXCEPTION 'contact_lines_missing: connect Facebook Messenger (send the code) before requesting a loan'
      USING ERRCODE = 'P0001';
  END IF;
  IF u.whatsapp_verified_at IS NULL AND coalesce(public.get_whatsapp_reminders_enabled(), false) THEN
    RAISE EXCEPTION 'contact_lines_missing: confirm your WhatsApp before requesting a loan'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_loan_request_contact_lines ON public.loans;
CREATE TRIGGER trg_enforce_loan_request_contact_lines
  BEFORE INSERT ON public.loans
  FOR EACH ROW EXECUTE FUNCTION private.enforce_loan_request_contact_lines();
