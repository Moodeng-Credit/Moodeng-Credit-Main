-- Pre-screening "💬 Ask more" (preScreeningAsk.ts): from the Telegram card the team asks the person a
-- few more questions on Messenger — written by the AI (Gemini, from the grade) or typed by the team and
-- made simple + Taglish by the AI. Their Messenger replies come back under the card.
alter table public.pre_screenings add column if not exists followup_draft jsonb;
-- [{team, en, local}] as sent.
alter table public.pre_screenings add column if not exists followup_questions jsonb;
alter table public.pre_screenings add column if not exists followup_sent_at timestamptz;
alter table public.pre_screenings add column if not exists followup_sent_by text;
-- {chat, msg}: the Telegram card their replies are posted under.
alter table public.pre_screenings add column if not exists followup_card jsonb;
-- [{text, at}] what they wrote back on Messenger.
alter table public.pre_screenings add column if not exists followup_answers jsonb not null default '[]'::jsonb;

create index if not exists pre_screenings_followup_open_idx
  on public.pre_screenings (user_id, followup_sent_at desc)
  where followup_sent_at is not null;
