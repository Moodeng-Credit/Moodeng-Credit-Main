-- Admin → Contacts: how each borrower can be reminded (George, 2026-10-19). One row per borrower:
-- phone notifications (working devices), and whether WhatsApp / Viber / Telegram / Messenger / email
-- reminders reach them. Push subscriptions are private to their owner, so this goes through an
-- admin-only function rather than a table read.

CREATE OR REPLACE FUNCTION public.admin_reminder_reach()
RETURNS TABLE (
  user_id UUID,
  push_devices INT,
  push_off BOOLEAN,
  messenger BOOLEAN,
  whatsapp_on BOOLEAN,
  whatsapp_stopped BOOLEAN,
  viber_number TEXT,
  viber_on BOOLEAN,
  telegram_on BOOLEAN,
  email_ok BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT
    u.id,
    -- Same "working" rule as get_my_reminder_reach: not failing, and delivered or new.
    (SELECT count(*)::int FROM public.push_subscriptions s
      WHERE s.user_id = u.id AND s.failure_count < 3
        AND (s.last_success_at IS NOT NULL OR s.created_at > now() - interval '30 days')),
    u.notif_push IS FALSE,
    u.messenger_psid IS NOT NULL,
    u.whatsapp_contact_id IS NOT NULL AND u.notif_whatsapp IS NOT FALSE,
    u.whatsapp_contact_id IS NOT NULL AND u.notif_whatsapp IS FALSE,
    u.viber_number,
    u.viber_number IS NOT NULL AND u.notif_viber IS NOT FALSE,
    u.chat_id IS NOT NULL,
    COALESCE(u.email, '') <> '' AND u.email !~* '^(telegram|line|phone)_[^@]+@moodeng\.(app|credit)$'
  FROM public.users u
  WHERE u.user_role = 'borrower';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reminder_reach() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reminder_reach() TO authenticated;
