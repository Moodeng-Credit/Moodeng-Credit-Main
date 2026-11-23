-- "Not working" on Messenger → one 🆘 card to the admin chat with where the borrower is stuck,
-- at most every 6 hours per conversation (messengerSupport.ts maybeAlertStuck claims this stamp).
alter table public.widget_conversations add column if not exists stuck_alerted_at timestamptz;
