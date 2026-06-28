-- Per-finding review state on fraud_signal_alerts.
--
-- The whitelist mutes an entire account. This is finer-grained: mark a single
-- finding as reviewed-and-ignored ("known / false positive, ignore for now")
-- without muting the whole account. Findings already in this table are suppressed
-- from re-emailing (dedup), so this column is for the human review trail + admin
-- filtering ("show me only open findings").

alter table public.fraud_signal_alerts
  add column if not exists review_status text not null default 'open'
    check (review_status in ('open', 'ignored', 'confirmed')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_note text;

create index if not exists fraud_signal_alerts_review_status_idx
  on public.fraud_signal_alerts (review_status);
