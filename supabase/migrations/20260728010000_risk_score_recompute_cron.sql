-- Schedule the daily risk-score batch.
--
-- Why: the Phase 2 heartbeat checks `risk_scores_26h` and reports "Risk scoring down"
-- whenever no score was computed in 26 hours. `risk-score-recompute` was deployed but
-- never scheduled, so that check fails every single morning — a permanent false alarm
-- that trains the team to ignore the heartbeat, which is exactly what the dead-man's
-- switch exists to prevent. The masterplan (§1.2) always specified a daily batch for the
-- consensus risk score; this is that batch.
--
-- Runs at 01:15 UTC: after the 00:45 fraud scan (so the two engines don't contend) and
-- ~8h before the 09:00 heartbeat, well inside the 26h window the check allows.
--
-- Auth: unlike fraud-signal-scan and security-heartbeat, this function enforces its own
-- header check (`X-Admin-Token` must equal the ADMIN_API_TOKEN secret) on top of the
-- platform's verify_jwt. Both values therefore have to be in place before this cron does
-- anything but log 401s:
--
--   1. Function secret, so the edge function knows the expected value:
--        supabase secrets set ADMIN_API_TOKEN=<token> --project-ref qplmmxynzxzkfxtayoqr
--   2. Vault secret, so this cron can present it:
--        select vault.create_secret('<token>', 'ADMIN_API_TOKEN',
--                                   'Shared secret for the risk-score-recompute cron');
--
-- Generate <token> with `openssl rand -hex 32` and use the SAME value for both. The cron
-- below reads it from vault at fire time, so rotating means updating the vault secret and
-- the function secret together — no migration change needed.

do $$
begin
  perform cron.unschedule('risk-score-recompute-daily');
exception
  when others then null;
end $$;

select cron.schedule(
  'risk-score-recompute-daily',
  '15 1 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/risk-score-recompute',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1),
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := '{"batch": true, "trigger": "daily_batch"}'::jsonb
  )
  $$
);
