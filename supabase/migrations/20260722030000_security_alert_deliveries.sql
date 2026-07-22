-- Phase 3a of the fraud-detection masterplan: one delivery ledger for the unified
-- security alert dispatcher (_shared/securityAlerts.ts).
--
-- Why: today the two detection engines (fraud-signal-scan and risk-score-recompute)
-- have separate, inconsistent delivery paths and no shared record of what was sent.
-- Phase 3 funnels every security alert — fraud scan, risk score, heartbeat, and the
-- Phase 4 real-time checks — through one dispatcher. This table records every send
-- attempt so the team (and the heartbeat) can see, per alert, whether Telegram and/or
-- email actually got through.
--
-- Writes come from the service role only (the dispatcher runs in edge functions with
-- the service-role key, which bypasses RLS); reads are admin-only. Mirrors the
-- security_job_runs ledger from Phase 2a (20260722010000).

create table if not exists public.security_alert_deliveries (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,               -- 'fraud-scan' | 'risk-score' | 'realtime' | 'heartbeat' | 'kyc'
  severity    text not null,               -- 'critical' | 'high' | 'warning' | 'info'
  title       text not null,               -- one-line summary (no emoji)
  telegram_ok boolean not null default false,
  email_ok    boolean not null default false,
  error       text,                        -- concatenated per-channel errors, if any
  created_at  timestamptz not null default now()
);

create index if not exists security_alert_deliveries_time_idx
  on public.security_alert_deliveries (created_at desc);
create index if not exists security_alert_deliveries_source_time_idx
  on public.security_alert_deliveries (source, created_at desc);

alter table public.security_alert_deliveries enable row level security;

-- Admin read-only. The service role bypasses RLS, so no insert policy is needed
-- (and none is wanted — clients must never write here).
drop policy if exists "admins read security alert deliveries" on public.security_alert_deliveries;
create policy "admins read security alert deliveries" on public.security_alert_deliveries
  for select to authenticated
  using (app_private.is_moodeng_admin());
