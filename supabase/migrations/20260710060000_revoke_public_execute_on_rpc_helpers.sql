-- Phase 4 follow-up: 20260710020000 (applied live as 20260709204437) revoked EXECUTE on these four
-- SECURITY DEFINER functions from anon/authenticated, but Postgres grants function EXECUTE to
-- PUBLIC by default and that grant was left in place — so anon could still call all four
-- (verified live via has_function_privilege + pg_proc.proacl: `=X/postgres`), and the security
-- advisor kept flagging them. Revoking from PUBLIC closes the gap; the explicit grants that
-- should survive (authenticated on the two read helpers, service_role everywhere) already exist
-- as direct ACL entries.

-- Trigger functions: fired by the trigger mechanism, never as RPCs. No client role needs EXECUTE.
revoke execute on function public.compute_risk_score_on_signup() from public;
revoke execute on function public.record_loan_request_delete_event() from public;

-- Read helpers scoped to auth.uid(): keep their existing direct `authenticated` grant, drop the
-- implicit everyone-grant that still let anon call them.
revoke execute on function public.can_create_loan_request(uuid) from public;
revoke execute on function public.get_loan_request_repost_status() from public;
