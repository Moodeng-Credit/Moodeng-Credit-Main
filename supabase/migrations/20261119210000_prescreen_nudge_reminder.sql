-- Pre-screening sweep (preScreeningAsk.ts preScreeningSweep, via kyc-cross-check {"prescreen_sweep": true}),
-- every 30 minutes:
--   * Nudge: asked follow-up questions on Messenger 6+ hours ago, no reply, not decided → one reminder
--     on Messenger (+ push), daytime Manila only, said under the card.
--   * Team reminder: a card still without ✅/❌ 3+ hours after it was posted (and not waiting on their
--     Messenger answers) → one "⏰ still waiting" reply under the card. Daytime Bangkok only.
-- team_card = the Telegram card (latest one posted with ✅/❌), so reminders reply under it.
alter table public.pre_screenings add column if not exists team_card jsonb;
alter table public.pre_screenings add column if not exists team_reminded_at timestamptz;
alter table public.pre_screenings add column if not exists followup_nudged_at timestamptz;

select cron.unschedule('prescreen-sweep') where exists (select 1 from cron.job where jobname = 'prescreen-sweep');
select cron.schedule('prescreen-sweep', '*/30 * * * *',
  $cron$select app_private.pre_screening_call('{"prescreen_sweep": true}'::jsonb)$cron$);
