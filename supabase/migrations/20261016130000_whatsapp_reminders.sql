-- WhatsApp payment reminders (docs/WHATSAPP_REMINDERS_PLAN.md).
--
-- Borrowers whose phone can't show notifications (Facebook's in-app browser, iPhone Safari without the
-- Home Screen app, notifications blocked or broken) opt in to WhatsApp reminders by sending their
-- one-time code to our business number (+66 95 165 9077, connected through SendPulse).
-- sendpulse-messenger-verify (channel 'whatsapp') stamps whatsapp_verified_at / whatsapp_number and the
-- SendPulse contact id below, which is what the send API needs. Reminders go out as Meta-approved
-- templates from borrowerNotificationDelivery.ts, only while the kill switch is on.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS whatsapp_contact_id TEXT,
  ADD COLUMN IF NOT EXISTS notif_whatsapp BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.users.whatsapp_contact_id IS
  'SendPulse WhatsApp contact id, set by sendpulse-messenger-verify when the borrower sends their code. Server-only.';
COMMENT ON COLUMN public.users.notif_whatsapp IS
  'WhatsApp reminders opt-out (false after they send STOP). Re-verifying turns it back on.';

CREATE INDEX IF NOT EXISTS users_whatsapp_contact_id_idx ON public.users (whatsapp_contact_id) WHERE whatsapp_contact_id IS NOT NULL;

-- whatsapp_contact_id decides where reminders go, so only server code may set it (the same rule as
-- messenger_psid in enforce_user_privileged_columns_server_only). A separate small trigger rather than
-- re-declaring that big guard function. notif_whatsapp stays client-writable: it's their preference.
CREATE OR REPLACE FUNCTION public.enforce_whatsapp_contact_server_only()
RETURNS trigger AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN new;
  END IF;

  IF TG_OP = 'INSERT' THEN
    new.whatsapp_contact_id := NULL;
    RETURN new;
  END IF;

  IF new.whatsapp_contact_id IS DISTINCT FROM old.whatsapp_contact_id THEN
    RAISE EXCEPTION 'users: whatsapp_contact_id can only be written by verified server-side code';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_whatsapp_contact_server_only ON public.users;
CREATE TRIGGER trg_enforce_whatsapp_contact_server_only
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_whatsapp_contact_server_only();

-- Kill switch: no WhatsApp reminder goes out, and the app shows no WhatsApp card, until the three
-- templates are approved in SendPulse and this is set to 'true'. One switch for both, so turning it on
-- needs no app deploy or Vercel change.
INSERT INTO public.telegram_bot_settings (key, value)
VALUES ('borrower_whatsapp_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_whatsapp_reminders_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value = 'true' FROM public.telegram_bot_settings WHERE key = 'borrower_whatsapp_enabled'), false);
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_reminders_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_reminders_enabled() TO authenticated;
