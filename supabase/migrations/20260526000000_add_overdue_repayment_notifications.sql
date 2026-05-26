ALTER TYPE loan_notification_type ADD VALUE IF NOT EXISTS 'overdue';
ALTER TYPE loan_notification_type ADD VALUE IF NOT EXISTS 'repayment_received';

DO $$
BEGIN
  PERFORM cron.unschedule('loan-overdue-notifications-hourly');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'loan-overdue-notifications-hourly',
  '15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-overdue-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
