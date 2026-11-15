-- Old-wallet watch: every hour security-heartbeat checks borrowers who still owe on a funded loan and reads the
-- USDC balance of the wallets they used before (supabase/functions/_shared/oldWalletWatch.ts). Money sitting in
-- a wallet their account no longer points at is invisible on their repay page, so the team is told once
-- (Discord #security, Telegram, email). Same auth headers as vault-watch-5min.
--
-- Apply only AFTER security-heartbeat is deployed with the old_wallet_watch action: an older deployment ignores
-- the action and would send the full daily heartbeat every hour.

do $$
begin
  perform cron.unschedule('old-wallet-watch-hourly');
exception
  when others then null;
end $$;

select cron.schedule(
  'old-wallet-watch-hourly',
  '25 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/security-heartbeat',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1),
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := '{"action":"old_wallet_watch"}'::jsonb
  )
  $$
);
