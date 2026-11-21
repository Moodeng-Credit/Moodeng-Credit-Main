-- When the Messenger booking bot's current chat began. A team member typing in the chat after this
-- makes the bot step aside (messengerBookingBot.teamHasChat).
alter table public.messenger_booking_chats add column if not exists started_at timestamptz not null default now();
