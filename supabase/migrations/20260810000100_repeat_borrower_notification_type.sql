-- Dedupe key for the "a borrower who repaid you is asking again" lender push.
--
-- Isolated in its own migration for the same reason as repayment_team_feed: a
-- newly added enum value cannot be referenced by the transaction that added it.
ALTER TYPE loan_notification_type ADD VALUE IF NOT EXISTS 'repeat_borrower_request';
