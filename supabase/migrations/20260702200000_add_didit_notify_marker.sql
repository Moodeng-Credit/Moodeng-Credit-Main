-- Dedupe marker for Didit outcome notifications. Both the didit-webhook (push) and
-- check-didit-status (pull sync) can now discover the same status change; whichever
-- sees it first atomically claims "<session_id>:<outcome>" here and sends the
-- user/admin notifications, and the other side skips. NULL = nothing notified yet.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS didit_notify_marker text;
