-- Phase 4 defense-in-depth: shrink the client-callable SECURITY DEFINER surface.
--
-- Context: an audit of every SECURITY DEFINER function flagged by the Supabase security advisor found
-- NO live privilege-escalation hole:
--   * admin_get_detection_overview / admin_get_login_geo / admin_set_fraud_alert_status all self-guard
--     with `if not app_private.is_moodeng_admin() then raise exception 'not authorized'` — they must
--     keep `authenticated` EXECUTE because the admin panel calls them with the admin's own JWT.
--   * redeem_referral_code validates the code (active/unexpired/under-max-uses), is one-time (gated on
--     redeemed_referral_code_id), and caps the boost — legitimately callable by `authenticated`.
--   * can_create_loan_request / get_loan_request_repost_status only read data scoped to auth.uid()
--     (anon gets empty/false — no data leak).
--
-- This migration only removes grants that no client path needs, to shrink the RPC surface and clear
-- advisor warnings. No behavioural change (verified on live: the delete-event trigger still fires and
-- borrowers can still delete Requested loans; the repost-status read still works for signed-in users).

-- Trigger functions: invoked by the trigger mechanism, never as PostgREST RPCs. EXECUTE grants are
-- irrelevant to trigger firing, so revoking them from clients is safe and removes the RPC endpoint.
REVOKE EXECUTE ON FUNCTION public.compute_risk_score_on_signup() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_loan_request_delete_event() FROM anon, authenticated;

-- Read helpers: scoped to auth.uid(); only signed-in borrowers use them. Keep authenticated, drop anon.
REVOKE EXECUTE ON FUNCTION public.can_create_loan_request(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_loan_request_repost_status() FROM anon;

-- Deliberately NOT changed (documented safe): admin_* (self-guard via is_moodeng_admin), and
-- redeem_referral_code (validated + one-time) keep authenticated EXECUTE. pg_net-in-public and the
-- three RLS-enabled-no-policy tables (risk_disposable_email_domains, support_sessions,
-- used_payment_hashes) are intentional deny-by-default / low-risk and left as-is.
