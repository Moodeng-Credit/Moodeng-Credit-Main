-- Data leaks reachable by anyone, even logged out (live-database sweep, 2026-10-02).
--
-- 1) widget_pending_nudges() (SECURITY DEFINER, executable by anon) returned support-chat visitors'
--    emails, names, page URLs and unread messages. Only the nudge-away-replies job (service role)
--    uses it.
-- 2) scan_payout_convergence() (SECURITY DEFINER, executable by anon) is a fraud scan: it returns flagged
--    payout destinations and records them as alerted, so running it hid them from the team. Only the
--    cron job and fraud-signal-scan (service role) call it.
-- 3) admin_overdue_or_defaulted_loans was a definer view readable by anon: every overdue / recently
--    defaulted loan with borrower and lender ids and amounts. It now runs with the caller's rights
--    (loans RLS: admins see all, users their own) and anon can't select it.

revoke all on function public.widget_pending_nudges(integer, integer) from public, anon, authenticated;
grant execute on function public.widget_pending_nudges(integer, integer) to service_role;

revoke all on function public.scan_payout_convergence(integer) from public, anon, authenticated;
grant execute on function public.scan_payout_convergence(integer) to service_role;

alter view public.admin_overdue_or_defaulted_loans set (security_invoker = true);
revoke all on public.admin_overdue_or_defaulted_loans from anon;
