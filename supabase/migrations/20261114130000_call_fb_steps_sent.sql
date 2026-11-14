-- When the "add Emma + join the group" message last went to this borrower (sent on the screening
-- call: automatically when Zoom first sees them, or by the host's button on the call sheet).
alter table public.users add column if not exists video_call_fb_steps_sent_at timestamptz;
