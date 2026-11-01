-- The Messenger call-booking bot's conversation, one row per SendPulse contact
-- (supabase/functions/_shared/messengerBookingBot.ts; state is bookingBot.ts BotState).
-- Edge functions only (service role): RLS on, no policies.
-- The bot is off unless telegram_bot_settings 'messenger_booking_bot' = 'test' (test accounts only).
create table if not exists public.messenger_booking_chats (
  contact_id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.messenger_booking_chats enable row level security;
