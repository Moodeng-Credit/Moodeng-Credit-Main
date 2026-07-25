-- Phase 2c: schedule the daily security heartbeat.
--
-- Runs at 09:00 UTC — during the team's waking hours and 8h after the 00:45 fraud
-- scan, so by the time the heartbeat fires the scan's result is already on record.
-- Posts to the security-heartbeat edge function with the service-role bearer token,
-- exactly like the fraud scan cron in 20260629000000. The function ALWAYS sends one
-- Telegram message; its absence is itself the alarm ("no heartbeat by 10:00 UTC =
-- incident", per the group description rule).
--
-- security-heartbeat gets no supabase/config.toml entry on purpose: fraud-signal-scan
-- has none either, so both run with the default verify_jwt and authenticate via the
-- service-role bearer token below. Mirroring that keeps the two crons identical.

do $$
begin
  perform cron.unschedule('security-heartbeat-daily');
exception
  when others then null;
end $$;

select cron.schedule(
  'security-heartbeat-daily',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/security-heartbeat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
