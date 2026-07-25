-- Phase 2a of the fraud-detection masterplan: a run ledger for security jobs.
--
-- Why: the daily fraud scan was silently broken for 11 days (2026-06-29 → 2026-07-10,
-- the abs(interval) bug fixed in 20260710050000) and nobody knew, because nothing
-- recorded whether the scan actually ran and succeeded. This table is the source of
-- truth the Phase 2b heartbeat reads to decide "is the detection pipeline alive?".
--
-- Each security job (fraud-signal-scan, risk-score-recompute, security-heartbeat)
-- writes exactly one row per invocation: started/finished timestamps, ok flag,
-- how many signals it produced, and a detail blob (delivery status / error text).
-- Writes come from the service role only; reads are admin-only.

create table if not exists public.security_job_runs (
  id           uuid primary key default gen_random_uuid(),
  job_name     text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  ok           boolean,
  signal_count integer,
  detail       jsonb not null default '{}'::jsonb
);

create index if not exists security_job_runs_job_time_idx
  on public.security_job_runs (job_name, started_at desc);

alter table public.security_job_runs enable row level security;

-- Admin read-only. The service role bypasses RLS, so no insert policy is needed
-- (and none is wanted — clients must never write here).
drop policy if exists "admins read security job runs" on public.security_job_runs;
create policy "admins read security job runs" on public.security_job_runs
  for select to authenticated
  using (app_private.is_moodeng_admin());
