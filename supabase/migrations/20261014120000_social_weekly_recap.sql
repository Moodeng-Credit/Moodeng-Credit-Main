-- Weekly social recap (social-weekly-recap): Mondays 09:00 Manila (01:00 UTC), retried hourly until noon;
-- the function posts at most once a week (telegram_bot_settings.social_recap_week).
DO $$
BEGIN
   PERFORM cron.unschedule('social-weekly-recap');
EXCEPTION
   WHEN OTHERS THEN
      NULL;
END $$;

SELECT cron.schedule(
   'social-weekly-recap',
   '0 1-4 * * 1',
   $$
   SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/social-weekly-recap',
      headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
   )
   $$
);
