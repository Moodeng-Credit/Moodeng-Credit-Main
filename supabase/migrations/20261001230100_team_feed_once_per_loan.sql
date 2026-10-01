-- One team post per loan: teamLoanFeed claims the row before posting, so the two callers of
-- loan-funded-notification (confirm-loan-payment and the app) can't both post it.
create unique index if not exists loan_notifications_team_feed_once
  on public.loan_notifications (loan_id, notification_type)
  where notification_type in ('team_funded', 'team_repaid');
