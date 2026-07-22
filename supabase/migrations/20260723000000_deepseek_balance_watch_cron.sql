-- Hourly DeepSeek credit watch: calls the deepseek-balance-watch edge function,
-- which alerts the admin KYC Telegram group when the shared DeepSeek balance
-- (Mecha support-chat + check-loan-input) drops to 25% of its last top-up.
-- Offset to :30 so it doesn't stack with the :00 hourly loan-notification job.

SELECT cron.schedule(
  'deepseek-balance-watch-hourly',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/deepseek-balance-watch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
