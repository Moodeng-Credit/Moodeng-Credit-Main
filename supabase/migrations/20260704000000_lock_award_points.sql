-- Lock down award_points: it must no longer be callable from the browser.
--
-- award_points is SECURITY DEFINER and accepts an arbitrary user_id + point delta. While it
-- was granted to anon/authenticated, any client could POST /rest/v1/rpc/award_points and mint
-- unlimited reward points for any account. The legitimate award now happens server-side in the
-- `award-loan-points` edge function (service_role), which re-derives the lender/amount/delta
-- from the loan. So the only role that should execute award_points is service_role.
--
-- ⚠️ Deploy order: ship the `award-loan-points` edge function AND the client change (which now
-- invokes it instead of calling the RPC directly) BEFORE running this migration. If this runs
-- first, funded loans will error on the old RPC and lenders silently stop earning points until
-- the new code is live. (Awarding is non-blocking, so funding itself is unaffected either way.)

revoke execute on function public.award_points(uuid, text, uuid, text, bigint, jsonb) from public, anon, authenticated;
grant  execute on function public.award_points(uuid, text, uuid, text, bigint, jsonb) to service_role;
