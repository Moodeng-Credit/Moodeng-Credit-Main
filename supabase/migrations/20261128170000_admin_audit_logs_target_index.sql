-- The admin account page and Users list read admin_audit_logs by target_user_id; with only the primary
-- key that was a full scan every time (2,222 seq scans, ~0.4 s mean, one timed out on 2026-11-28).
create index if not exists admin_audit_logs_target_user_id_created_at_idx
  on public.admin_audit_logs (target_user_id, created_at desc);
