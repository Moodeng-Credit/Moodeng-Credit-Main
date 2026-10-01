-- Team #loans posts for "loan funded" / "loan repaid" (supabase/functions/_shared/teamLoanFeed.ts).
alter type public.loan_notification_type add value if not exists 'team_funded';
alter type public.loan_notification_type add value if not exists 'team_repaid';
