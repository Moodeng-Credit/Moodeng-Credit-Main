-- Can our due-date reminders actually reach this borrower? (George, 2026-10-18)
--
-- A borrower with no working push, no Messenger link and no WhatsApp only gets email reminders. When
-- they come back for a new loan, LoanRequestModal shows ContactsStep with reminders required (push, or
-- WhatsApp where push can't work). This tells the app which case it is, for the signed-in user only.
--
--   push_working        a push subscription that isn't failing (404/410s are deleted by pushDelivery;
--                       failure_count counts the rest) and has delivered, or is new enough not to have
--                       had a reminder yet. notif_push = false counts as no push.
--   messenger_reachable the bot has their Messenger id (messenger_psid), not just a confirmed code.
--   whatsapp_reachable  linked SendPulse WhatsApp contact and they haven't sent STOP.

CREATE OR REPLACE FUNCTION public.get_my_reminder_reach()
RETURNS TABLE (push_working BOOLEAN, messenger_reachable BOOLEAN, whatsapp_reachable BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(u.notif_push, true) AND EXISTS (
      SELECT 1 FROM public.push_subscriptions s
      WHERE s.user_id = u.id
        AND s.failure_count < 3
        AND (s.last_success_at IS NOT NULL OR s.created_at > now() - interval '30 days')
    ),
    u.messenger_psid IS NOT NULL,
    u.whatsapp_contact_id IS NOT NULL AND u.notif_whatsapp IS NOT FALSE
  FROM public.users u
  WHERE u.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_reminder_reach() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_reminder_reach() TO authenticated;
