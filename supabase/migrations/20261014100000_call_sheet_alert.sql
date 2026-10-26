-- Pre-call "open the call sheet" alert (video-call-reminders): about 15 minutes before an onboarding call,
-- the team gets a post in Alerts Moodeng HQ (Telegram team group) and Discord #bookings with the
-- borrower, time, host, and buttons to open the call sheet and join the Zoom. Stamped here so each
-- booking gets it once; a rebooked call (new start time) clears it in the function.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS video_call_sheet_alerted_at timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS video_call_sheet_alerted_for timestamptz;
