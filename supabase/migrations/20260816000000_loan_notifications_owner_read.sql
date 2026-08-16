-- Let a signed-in user read their OWN loan_notifications rows.
--
-- Why: the in-app "Loan request expired" toast (ExpiredLoanRequestNotifier) was
-- re-deriving "expired" from the permanent `Requested` row on every load and only
-- suppressing itself via per-device localStorage — so it nagged forever and came
-- back on every new device / cleared cache. The backend already records a durable,
-- once-per-user "request_expired" row in loan_notifications when it reaches the
-- borrower (see the loan-request-expired-notifications function + hourly cron).
-- Exposing those rows (own-rows only) lets the client defer to that record and
-- stop nagging people who were already notified.
--
-- Additive and read-only: existing service_role ALL policy is untouched; this only
-- grants authenticated users SELECT on rows they own.

DROP POLICY IF EXISTS "Users can read own loan notifications" ON public.loan_notifications;
CREATE POLICY "Users can read own loan notifications"
  ON public.loan_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
