-- What the automatic ✅ check decided and why (red flags), saved on the row.
-- Before this the reason was only posted as a Telegram reply under the card.
alter table public.pre_screenings add column if not exists auto_check jsonb;

comment on column public.pre_screenings.auto_check is
  'Last automatic approve check: {stage: grade|answers, score, bar, flags[], result: approved|held, at}. Written by kyc-cross-check / sendpulse-events (preScreeningAsk.ts).';
