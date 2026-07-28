-- Have the two existing security crons present the shared cron secret.
--
-- Companion to the `checkCronAuth` guard added to fraud-signal-scan and security-heartbeat.
-- Those functions have no config.toml entry, so the platform's default verify_jwt accepts
-- ANY valid project JWT — including the anon key shipped in the client bundle. Until now
-- that meant any visitor could trigger a full fraud scan or a heartbeat and push messages
-- into the team's Telegram group.
--
-- Only the headers change here; schedules, URLs, and bodies are byte-identical to
-- 20260629000000 (fraud scan, 00:45 UTC) and 20260722020000 (heartbeat, 09:00 UTC).
--
-- ORDER OF OPERATIONS — this migration is safe to apply at any time:
--   * The guard fails open while ADMIN_API_TOKEN is unset, so applying this before the
--     secret exists changes nothing (an absent vault secret makes the header NULL, and
--     jsonb_build_object drops NULL-valued keys, so the request goes out header-less and
--     is accepted exactly as today).
--   * Once ADMIN_API_TOKEN is set in BOTH function secrets and vault, the guard starts
--     enforcing and these crons already carry the header.
--
-- Setting the secret (same value in both places — generate with `openssl rand -hex 32`):
--   supabase secrets set ADMIN_API_TOKEN=<token> --project-ref qplmmxynzxzkfxtayoqr
--   select vault.create_secret('<token>', 'ADMIN_API_TOKEN', 'Shared secret for the security crons');

do $$
begin
  perform cron.unschedule('wallet-fraud-signal-scan-daily');
exception
  when others then null;
end $$;

select cron.schedule(
  'wallet-fraud-signal-scan-daily',
  '45 0 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/fraud-signal-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1),
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := '{}'::jsonb
  )
  $$
);

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
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1),
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
