ALTER TYPE loan_notification_type ADD VALUE IF NOT EXISTS 'request_expired';

DO $$
BEGIN
  PERFORM cron.unschedule('loan-request-expired-notifications-hourly');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'loan-request-expired-notifications-hourly',
  '20 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-request-expired-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
