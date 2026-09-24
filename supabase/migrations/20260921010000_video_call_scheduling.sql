-- Video-call scheduling gate for the end-of-application flow.
--
-- A borrower who arrives with no referral code doesn't yet have a human at Moodeng who can vouch
-- for them, so before they can post a loan request they have to SCHEDULE (not complete) a short
-- video call with George or Emma via Calendly. A referral code skips this — the referrer already
-- vouches for them.
--
-- We don't trust the client's "I scheduled it" tap on its own (nothing stops a borrower closing
-- the Calendly tab without booking and just clicking through). The real gate is
-- video_call_scheduled_at, set only by the calendly-webhook edge function when Calendly's own
-- invitee.created event confirms a real booking — the same "webhook is the source of truth"
-- pattern as WhatsApp verification.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS video_call_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_call_host TEXT,
  ADD COLUMN IF NOT EXISTS video_call_starts_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.video_call_scheduled_at IS
  'When Calendly confirmed (via webhook) this borrower booked their no-referral video interview. NULL = not booked.';
COMMENT ON COLUMN public.users.video_call_host IS
  'Which Moodeng team member the borrower booked with — "george" or "emma" — read from the Calendly event''s scheduling link.';
COMMENT ON COLUMN public.users.video_call_starts_at IS
  'The scheduled start time of the booked call, from the Calendly event payload.';
