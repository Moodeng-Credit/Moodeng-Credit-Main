-- When our Zoom webhook first heard anything about THIS booking's meeting (host, team or borrower).
-- The automatic no-show needs it: a host's Zoom can be one our webhook doesn't watch (George moved his
-- Cal.com to his personal Zoom on 2026-11-14), and silence from an unwatched meeting proves nothing.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS video_call_zoom_seen_at TIMESTAMPTZ;
