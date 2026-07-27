-- Add a dedicated notification type for the team-group "loan repaid" feed so it can be de-duplicated
-- per loan independently of the borrower/lender repayment DMs. Isolated in its own migration because a
-- newly added enum value cannot be referenced until the transaction that added it has committed.
ALTER TYPE loan_notification_type ADD VALUE IF NOT EXISTS 'repayment_team_feed';
