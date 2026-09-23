-- loan-request-expired-notifications runs with verify_jwt (the gateway is its only auth check), but its
-- cron only sent x-notification-secret, so every hourly run was rejected with UNAUTHORIZED_NO_AUTH_HEADER.
-- Add the Authorization header the gateway needs; schedule, URL and body are unchanged.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'loan-request-expired-notifications-hourly'),
  command := $cmd$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-request-expired-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1),
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
  $cmd$
);
