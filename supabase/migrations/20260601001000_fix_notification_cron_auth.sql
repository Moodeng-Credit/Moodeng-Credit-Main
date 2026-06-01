CREATE OR REPLACE FUNCTION public.verify_internal_notification_secret(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name IN ('INTERNAL_NOTIFICATION_SECRET', 'MOODENG_INTERNAL_CRON_SECRET', 'SUPABASE_SECRET_KEY')
      AND decrypted_secret = candidate
  );
$$;

REVOKE ALL ON FUNCTION public.verify_internal_notification_secret(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_internal_notification_secret(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_internal_notification_secret(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_internal_notification_secret(TEXT) TO service_role;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.notify_loan_request_telegram()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  project_url TEXT;
  notification_secret TEXT;
BEGIN
  IF NEW.loan_status <> 'Requested' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
  INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_PROJECT_URL'
  LIMIT 1;

  SELECT decrypted_secret
  INTO notification_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('INTERNAL_NOTIFICATION_SECRET', 'MOODENG_INTERNAL_CRON_SECRET', 'SUPABASE_SECRET_KEY')
  ORDER BY CASE name
    WHEN 'INTERNAL_NOTIFICATION_SECRET' THEN 1
    WHEN 'MOODENG_INTERNAL_CRON_SECRET' THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF project_url IS NULL OR notification_secret IS NULL THEN
    RAISE WARNING 'Telegram lender notification skipped: Supabase project URL or notification secret missing from vault.';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/loan-request-telegram-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-secret', notification_secret
    ),
    body := jsonb_build_object('loanId', NEW.id)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.notify_loan_request_telegram() FROM PUBLIC;

DO $$
BEGIN
  PERFORM cron.unschedule('loan-due-notifications-hourly');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('loan-overdue-notifications-hourly');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('loan-request-expired-notifications-hourly');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('loan-weekly-digest-weekly');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'loan-due-notifications-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-due-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name IN ('INTERNAL_NOTIFICATION_SECRET', 'MOODENG_INTERNAL_CRON_SECRET', 'SUPABASE_SECRET_KEY')
        ORDER BY CASE name
          WHEN 'INTERNAL_NOTIFICATION_SECRET' THEN 1
          WHEN 'MOODENG_INTERNAL_CRON_SECRET' THEN 2
          ELSE 3
        END
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  )
  $$
);

SELECT cron.schedule(
  'loan-overdue-notifications-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-overdue-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name IN ('INTERNAL_NOTIFICATION_SECRET', 'MOODENG_INTERNAL_CRON_SECRET', 'SUPABASE_SECRET_KEY')
        ORDER BY CASE name
          WHEN 'INTERNAL_NOTIFICATION_SECRET' THEN 1
          WHEN 'MOODENG_INTERNAL_CRON_SECRET' THEN 2
          ELSE 3
        END
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  )
  $$
);

SELECT cron.schedule(
  'loan-request-expired-notifications-hourly',
  '20 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-request-expired-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name IN ('INTERNAL_NOTIFICATION_SECRET', 'MOODENG_INTERNAL_CRON_SECRET', 'SUPABASE_SECRET_KEY')
        ORDER BY CASE name
          WHEN 'INTERNAL_NOTIFICATION_SECRET' THEN 1
          WHEN 'MOODENG_INTERNAL_CRON_SECRET' THEN 2
          ELSE 3
        END
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  )
  $$
);

SELECT cron.schedule(
  'loan-weekly-digest-weekly',
  '0 0 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name IN ('INTERNAL_NOTIFICATION_SECRET', 'MOODENG_INTERNAL_CRON_SECRET', 'SUPABASE_SECRET_KEY')
        ORDER BY CASE name
          WHEN 'INTERNAL_NOTIFICATION_SECRET' THEN 1
          WHEN 'MOODENG_INTERNAL_CRON_SECRET' THEN 2
          ELSE 3
        END
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  )
  $$
);
