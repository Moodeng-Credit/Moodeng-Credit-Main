-- "ok here in messenger only" to the text-reminder ask: we confirm Messenger reminders once per booking
-- (supabase/functions/_shared/callReminderChannel.ts). Holds the booking uid it was answered for.
alter table public.users add column if not exists video_call_messenger_only_uid text;
