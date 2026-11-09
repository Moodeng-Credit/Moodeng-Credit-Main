-- BitRepo vault watch: every 5 minutes security-heartbeat compares the vault's live state with the loans we
-- recorded through Vault Lend (supabase/functions/_shared/vaultWatch.ts). A draw no Moodeng loan accounts for,
-- our cover going down, a pause or a lost draw permission alerts Discord #security, Telegram and email; our
-- own draws and repayments post one info line to Discord. Same auth headers as security-heartbeat-daily.
--
-- Apply only AFTER security-heartbeat is deployed with the vault_watch action: an older deployment ignores the
-- action and would send the full daily heartbeat every 5 minutes.

do $$
begin
  perform cron.unschedule('vault-watch-5min');
exception
  when others then null;
end $$;

select cron.schedule(
  'vault-watch-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/security-heartbeat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1),
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := '{"action":"vault_watch"}'::jsonb
  )
  $$
);
