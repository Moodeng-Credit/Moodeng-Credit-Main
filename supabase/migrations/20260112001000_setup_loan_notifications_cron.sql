-- Enable the pg_cron extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable the pg_net extension to make HTTP requests from the database
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Schedule the loan-due-notifications function to run daily at midnight
-- This uses the project URL and secret key stored in Supabase Vault for security and environment neutrality.
-- Ensure secrets 'SUPABASE_PROJECT_URL' and 'SUPABASE_SECRET_KEY' are added to the Vault.
SELECT cron.schedule(
  'loan-due-notifications-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-due-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  )
  $$
);

COMMENT ON COLUMN loan_notifications.email_sent_at IS 'When the notification was actually sent to the user.';
