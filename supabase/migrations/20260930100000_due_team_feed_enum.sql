-- Notification types used to announce "due today" and "overdue" loans to the operator team group
-- exactly once per loan. Isolated in its own migration because a newly added enum value cannot be
-- referenced until the transaction that added it has committed.
ALTER TYPE loan_notification_type ADD VALUE IF NOT EXISTS 'team_due_today';
ALTER TYPE loan_notification_type ADD VALUE IF NOT EXISTS 'team_overdue';
