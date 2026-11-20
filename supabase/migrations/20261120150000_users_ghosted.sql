-- /ghost @username in the admin Telegram channels: a quiet reject (no message to the borrower) plus
-- the SendPulse Messenger bot turned off for them. These record who did it and when (/unghost clears).
alter table public.users add column if not exists ghosted_at timestamptz;
alter table public.users add column if not exists ghosted_by text;
