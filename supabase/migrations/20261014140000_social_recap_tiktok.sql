-- social-weekly-recap now includes TikTok (Apify). The Apify token lives in the vault (APIFY_TOKEN, the
-- project is at its 100 edge-function-secret cap) and is passed in the body; the scrape takes up to ~2 min.
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
      body := jsonb_build_object('apifyToken', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'APIFY_TOKEN' LIMIT 1)),
      timeout_milliseconds := 180000
   )
   $$
);
