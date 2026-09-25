-- Overdue follow-ups: besides the first overdue notice, loan-overdue-notifications now sends a gentle
-- check-in at 3 and 7 days late. Each stage is recorded per loan (loan_notifications_unique_non_weekly
-- keeps it to once), so each needs its own notification type.
alter type public.loan_notification_type add value if not exists 'overdue_followup_3';
alter type public.loan_notification_type add value if not exists 'overdue_followup_7';
