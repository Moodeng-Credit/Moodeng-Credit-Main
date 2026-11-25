-- The "👍 Got it! See you …" answer to "Reply OK to keep your spot" goes out once per booking.
-- Cleared with the rest of the attendance fields when a call is booked or moved (ATTENDANCE_RESET).
alter table public.users add column if not exists video_call_keep_spot_ok_at timestamptz;
