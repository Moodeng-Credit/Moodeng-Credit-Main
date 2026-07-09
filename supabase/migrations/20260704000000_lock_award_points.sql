-- Lock down award_points: it must no longer be callable from the browser.
--
-- award_points is SECURITY DEFINER and accepts an arbitrary user_id + point delta. While it was
-- granted to anon/authenticated, any client could POST /rest/v1/rpc/award_points and mint unlimited
-- reward points for any account (incl. Founding Lucky Cat eligibility) — even logged out.
--
-- The legitimate award now happens server-side inside the `confirm-loan-payment` edge function
-- (service_role), which re-derives the lender / loan amount / prior-funded-loan count from the DB and
-- awards points as a verified side effect of a real, on-chain-confirmed funding. So the only role that
-- should execute award_points is service_role.
--
-- Provenance: the revoke itself is salvaged from PR #564 (fix/award-points-server-side). That PR also
-- introduced a standalone `award-loan-points` edge function + a loanSlice change to call it; both are
-- SUPERSEDED here because confirm-loan-payment already awards funding points inline (same BigInt math),
-- so only this grant change is carried over. See [[supabase-security-advisor-findings]].
--
-- ⚠️ Deploy order: deploy the `confirm-loan-payment` edge function (which awards points via service_role)
-- BEFORE running this migration. If this runs first, any old client path still calling the RPC directly
-- errors and lenders silently stop earning points until the new code is live. (Awarding is non-blocking,
-- so funding itself is unaffected either way.)

revoke execute on function public.award_points(uuid, text, uuid, text, bigint, jsonb) from public, anon, authenticated;
grant  execute on function public.award_points(uuid, text, uuid, text, bigint, jsonb) to service_role;
