-- reminders-stuck: when a borrower's push reminders can't turn on (blocked, failed, or inside
-- Facebook's browser), the bot messages them the Chrome/Safari fix and the team gets a heads-up.
-- This keeps it to once per borrower per day.
alter table public.users add column if not exists reminders_stuck_alerted_at timestamptz;
