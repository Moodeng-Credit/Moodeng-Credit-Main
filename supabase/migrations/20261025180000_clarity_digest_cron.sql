-- Onboarding friction digest (admin-ux-metrics, action clarity_digest): every 3 days at 08:00 Bangkok
-- (01:00 UTC) to the team Telegram group + Discord. Clarity's export API token and project id live in the
-- vault (CLARITY_API_TOKEN, CLARITY_PROJECT_ID; the project is at its edge-function-secret cap) and are
-- passed in the body. Without the token the digest still posts the sign-up steps and says Clarity is missing.
DO $$
BEGIN
   PERFORM cron.unschedule('clarity-digest');
EXCEPTION
   WHEN OTHERS THEN
      NULL;
END $$;

SELECT cron.schedule(
   'clarity-digest',
   '0 1 */3 * *',
   $$
   SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/admin-ux-metrics',
      headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
      ),
      body := jsonb_build_object(
         'action', 'clarity_digest',
         'clarityToken', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CLARITY_API_TOKEN' LIMIT 1),
         'clarityProjectId', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CLARITY_PROJECT_ID' LIMIT 1)
      ),
      timeout_milliseconds := 120000
   )
   $$
);
