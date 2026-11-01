-- 15-minute holds for the Messenger call-booking bot (supabase/functions/_shared/messengerBookingBot.ts):
-- the time a chat is holding (UTC instant) and when the hold runs out. Other chats don't offer a held time.
alter table public.messenger_booking_chats
  add column if not exists held_start timestamptz,
  add column if not exists held_until timestamptz;

create index if not exists messenger_booking_chats_held_until_idx
  on public.messenger_booking_chats (held_until)
  where held_start is not null;
