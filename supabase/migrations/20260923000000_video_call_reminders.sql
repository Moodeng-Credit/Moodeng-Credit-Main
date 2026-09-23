-- Video-call no-show reminders.
--
-- Booking a call (calcom-round-robin) stamps users.video_call_starts_at, and Cal.com emails the
-- borrower a confirmation — but email is easy to miss and the call never auto-lands in their
-- calendar, so people forget and don't show up. This adds our own reminders over the channels we
-- already own (web push + Telegram): a day-before nudge and a "starting soon" nudge.
--
-- video_call_reminder_stage tracks how far along the reminder ladder a booking is, so the 15-minute
-- cron never double-sends: 0 = none, 1 = day-before sent, 2 = hour-before sent. calcom-round-robin
-- resets it to 0 on every new booking so a re-booked borrower is reminded again.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS video_call_reminder_stage SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  PERFORM cron.unschedule('video-call-reminders-15min');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'video-call-reminders-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/video-call-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
