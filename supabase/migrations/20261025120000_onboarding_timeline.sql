-- Onboarding timeline for the team alerts (Telegram + Discord): how the borrower signed up, which
-- notification channels they turned on, and every onboarding step with its time, so the alert can
-- show how long each step took. Built from timestamps we already store — no PostHog needed.
-- Called by the edge functions with the service key only.

CREATE OR REPLACE FUNCTION public.onboarding_timeline(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH u AS (
    SELECT * FROM public.users WHERE id = p_user_id
  ),
  codes AS (
    SELECT channel, min(created_at) AS tapped_at, min(chat_opened_at) AS opened_at
      FROM public.contact_verification_codes
     WHERE user_id = p_user_id
     GROUP BY channel
  ),
  steps(step, at) AS (
    SELECT 'Signed up', u.created_at FROM u
    UNION ALL SELECT 'Tapped Connect Messenger', tapped_at FROM codes WHERE channel = 'messenger'
    UNION ALL SELECT 'Opened Messenger chat', opened_at FROM codes WHERE channel = 'messenger'
    UNION ALL SELECT 'Messenger connected', u.messenger_verified_at FROM u
    UNION ALL SELECT 'Tapped Connect WhatsApp', tapped_at FROM codes WHERE channel = 'whatsapp'
    UNION ALL SELECT 'WhatsApp connected', u.whatsapp_verified_at FROM u
    UNION ALL SELECT 'Viber connected', u.viber_verified_at FROM u
    UNION ALL SELECT 'Skipped contact step', u.contact_step_skipped_at FROM u
    UNION ALL SELECT 'Turned on push', (SELECT min(created_at) FROM public.push_subscriptions WHERE user_id = p_user_id)
    UNION ALL SELECT 'Wallet connected', u.wallet_connected_at FROM u
    UNION ALL SELECT 'Asked to connect / booked call',
                     (SELECT min(created_at) FROM public.loan_access_requests WHERE user_id = p_user_id)
    UNION ALL SELECT 'Call booked', u.video_call_scheduled_at FROM u
    UNION ALL SELECT 'Joined call', u.video_call_joined_at FROM u
    UNION ALL SELECT 'Approved to borrow', u.loan_access_approved_at FROM u
    UNION ALL SELECT 'ID check submitted', u.didit_submitted_at FROM u
    UNION ALL SELECT 'First loan funded',
                     (SELECT min(funded_at) FROM public.loans WHERE borrower_user_id = p_user_id AND NOT coalesce(is_test, false))
  )
  SELECT jsonb_build_object(
           'method', app_private.signup_method(p_user_id),
           'phone', coalesce(
             (SELECT nullif(trim(a.phone), '') FROM auth.users a WHERE a.id = p_user_id),
             (SELECT nullif(trim(coalesce(u.whatsapp_number, u.viber_number)), '') FROM u)
           ),
           'channels', (
             SELECT jsonb_agg(c) FROM (
               SELECT 'Messenger' AS c FROM u WHERE u.messenger_verified_at IS NOT NULL
               UNION ALL SELECT 'WhatsApp' FROM u WHERE u.whatsapp_verified_at IS NOT NULL
               UNION ALL SELECT 'Viber' FROM u WHERE u.viber_verified_at IS NOT NULL
               UNION ALL SELECT 'Telegram' FROM u WHERE u.chat_id IS NOT NULL
               UNION ALL SELECT 'Push' WHERE EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = p_user_id)
               UNION ALL SELECT 'Email' FROM u WHERE u.email IS NOT NULL AND u.email NOT LIKE '%@%.invalid'
                                               AND u.email !~ '^(phone|telegram|line)_' AND u.email_unsubscribed_at IS NULL
             ) ch
           ),
           'steps', coalesce((SELECT jsonb_agg(jsonb_build_object('step', step, 'at', at) ORDER BY at)
                                FROM steps WHERE at IS NOT NULL), '[]'::jsonb)
         );
$$;

REVOKE ALL ON FUNCTION public.onboarding_timeline(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_timeline(uuid) TO service_role;
