-- Messenger call-booking bot: one nudge when a chat stops partway (messengerBookingBot.nudgeStalledChats,
-- run by video-call-reminders' cron), and where they stopped saved for the admin call sheet.
--   messenger_booking_chats.nudged_at: when the last nudge went out (one per stall: only if older than updated_at).
--   booking_bot_answers kind 'stalled': held_off_question = the question (or step) they stopped at,
--   held_off_value = the bot step, items = what they'd answered so far.
alter table public.messenger_booking_chats add column if not exists nudged_at timestamptz;

alter table public.booking_bot_answers drop constraint if exists booking_bot_answers_kind_check;
alter table public.booking_bot_answers add constraint booking_bot_answers_kind_check check (kind in ('answers', 'held_off', 'stalled'));
