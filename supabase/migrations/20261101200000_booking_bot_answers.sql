-- What borrowers answered the Messenger call-booking bot (supabase/functions/_shared/messengerBookingBot.ts),
-- kept for the team: one row each time they finish the questions ('answers') or are held off ('held_off').
-- Shown on the admin call sheet. Questions and answers are in English, in the order asked; typed answers
-- are in their own words. The fit check is a rules-based team note, never a decision.
-- Written by edge functions (service role); admins read.
create table if not exists public.booking_bot_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('answers', 'held_off')),
  items jsonb not null default '[]'::jsonb, -- [{ "q": question, "a": answer }]
  fit_verdict text,
  fit_reason text,
  checks text[] not null default '{}',
  held_off_question text,
  held_off_value text,
  lang text,
  market text,
  holding_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists booking_bot_answers_user_idx on public.booking_bot_answers (user_id, created_at desc);

alter table public.booking_bot_answers enable row level security;
revoke all on public.booking_bot_answers from anon;
drop policy if exists booking_bot_answers_admin_read on public.booking_bot_answers;
create policy booking_bot_answers_admin_read on public.booking_bot_answers for select to authenticated
  using (app_private.is_moodeng_admin());
