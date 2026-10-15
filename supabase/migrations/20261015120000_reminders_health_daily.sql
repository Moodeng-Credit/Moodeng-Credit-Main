-- Daily reminders health check: 09:00 Bangkok (02:00 UTC). messenger-stuck-alerts { reminders: true, mode: 'daily_check' }
-- alerts the team when borrowers reached the reminders step in the last 24h but no phone signed up.
-- Same pattern as messenger-stuck-alerts: pg_net POST with the secret key from Vault.
DO $$
BEGIN
  PERFORM cron.unschedule('reminders-health-daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'reminders-health-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/messenger-stuck-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{"reminders":true,"mode":"daily_check"}'::jsonb
  )
  $$
);
