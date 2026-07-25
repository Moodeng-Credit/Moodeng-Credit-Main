-- Whitelist all admin accounts from fraud detection.
--
-- Context: the team (George, Emma, ...) legitimately operates many accounts
-- across BOTH the borrower and lender roles for testing. Without this, the very
-- first fraud scan / heartbeat would flag the founders as the platform's top
-- self-lenders (shared wallet, self-deal, cross-role shared IP), flooding the
-- alert group with false positives.
--
-- The 2026-06-29 rollout baseline (`20260629010000_fraud_detection_whitelist.sql`)
-- already whitelisted every account that existed at launch. This migration adds
-- the *admin* accounts declaratively, so it also covers any admin account created
-- since that baseline and re-affirms the set idempotently.
--
-- Definition of "admin account" (mirrors `app_private.is_moodeng_admin()` plus the
-- frontend `ADMIN_ACCOUNT_EMAILS` allowlist in `src/config/loanFundingConfig.ts`):
--   1. active rows in `public.admin_users` (role owner/admin/support), OR
--   2. a user whose email is one of the known admin emails.
--
-- Whitelisting is symmetric with the scan logic: a finding is suppressed only when
-- EVERY account it involves is whitelisted. If an admin account overlaps with a
-- real (non-whitelisted) user, the signal still fires — real abuse is unaffected.

insert into public.fraud_detection_whitelist (user_id, reason)
select u.id,
       'admin account: exempt from fraud signals (team runs many test accounts across roles)'
from public.users u
where u.id in (
        select au.user_id
        from public.admin_users au
        where au.active = true
          and au.role in ('owner', 'admin', 'support')
      )
   or lower(btrim(u.email)) in (
        'georgemlerner@gmail.com',
        'georgedevdao@gmail.com',
        'chonlagarn.i@gmail.com',
        'telegram_1384264294@moodeng.credit',
        'emmacute1@atomicmail.io',
        'line_u655bfb6e597a640f8447e74cbede5bce@moodeng.app'
      )
on conflict (user_id) do nothing;
