-- Correct the scope of the fraud-detection whitelist.
--
-- Problem: the 2026-06-29 rollout baseline (`20260629010000_fraud_detection_whitelist.sql`)
-- blanket-whitelisted EVERY account that existed at launch (~89 accounts). That was fine
-- when everyone was a team tester, but the platform now has real users. A whitelisted
-- account is exempt from fraud signals, so ~85 real/legacy accounts were silently masked
-- from the self-lending / shared-wallet / shared-IP scans.
--
-- Founder decision (2026-07-26): ONLY the current admin team — accounts with admin-panel
-- access, i.e. active rows in `public.admin_users` — should be exempt. Everyone else,
-- including the team's own NON-admin test personas and all real users, is subject to
-- detection. (Supersedes the reverted per-email whitelist migration.)
--
-- Effect on scan logic: a finding is suppressed only when EVERY involved account is
-- whitelisted. With the whitelist reduced to admins, an admin account that overlaps a
-- real user still fires the signal — as intended.

-- 1. Prune: remove every whitelist entry that is not an active admin.
delete from public.fraud_detection_whitelist wl
where not exists (
  select 1
  from public.admin_users au
  where au.user_id = wl.user_id
    and au.active = true
);

-- 2. Ensure every active admin is whitelisted (idempotent; covers admins added later
--    who were never in the rollout baseline).
insert into public.fraud_detection_whitelist (user_id, reason)
select au.user_id, 'admin-panel team (active admin_users)'
from public.admin_users au
where au.active = true
on conflict (user_id) do nothing;
