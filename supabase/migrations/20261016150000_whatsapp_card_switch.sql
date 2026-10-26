-- WhatsApp: separate switch for the "Get reminders on WhatsApp" card.
--
-- Until now borrower_whatsapp_enabled turned on both the card and the sending. Confirming a number
-- only needs the borrower to message us (no Meta templates or SendPulse funds), so the card can go
-- live now while sending waits for Meta to approve the templates.
--   borrower_whatsapp_card_enabled  the card + MDNG confirmation (read by get_whatsapp_reminders_enabled)
--   borrower_whatsapp_enabled       sending WhatsApp reminders (read by the reminder edge functions)

INSERT INTO public.telegram_bot_settings (key, value)
VALUES ('borrower_whatsapp_card_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_whatsapp_reminders_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value = 'true' FROM public.telegram_bot_settings WHERE key = 'borrower_whatsapp_card_enabled'), false);
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_reminders_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_reminders_enabled() TO authenticated;
