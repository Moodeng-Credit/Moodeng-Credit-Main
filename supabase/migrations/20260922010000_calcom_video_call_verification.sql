-- Move the no-referral video-call gate from client-asserted to server-verified, via Cal.com.
--
-- Calendly's webhooks need a paid plan, so the booking was recorded by the client calling
-- mark_video_call_scheduled() the moment Calendly's in-page event fired — i.e. the borrower's own
-- browser asserting "I booked," which a determined borrower could fake. Cal.com's free plan has
-- signed webhooks, so the new calcom-webhook edge function is now the only thing that sets
-- users.video_call_scheduled_at: it fires on a real BOOKING_CREATED, matched to the borrower by the
-- moodeng_user_id we pass through the embed's metadata, exactly like the WhatsApp/Messenger flow.
--
-- video_call_scheduled_at / video_call_host / video_call_starts_at already exist (video-call
-- scheduling migration). This adds the Cal.com booking uid so a later BOOKING_CANCELLED can be
-- matched to the exact booking and reopen the gate, and revokes the old client-side RPC so the
-- browser can no longer self-assert a booking.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS video_call_booking_uid TEXT;

COMMENT ON COLUMN public.users.video_call_booking_uid IS
  'Cal.com booking uid captured by calcom-webhook on BOOKING_CREATED. Used to match a later BOOKING_CANCELLED back to this borrower so the gate can reopen. NULL = no confirmed booking.';

-- The gate is now webhook-verified, so the client must not be able to mark itself scheduled.
-- Keep the function (a redeploy of the old frontend shouldn't error), but take away the
-- authenticated role's right to call it — only the service-role webhook writes these columns now.
REVOKE EXECUTE ON FUNCTION public.mark_video_call_scheduled(TEXT, TIMESTAMPTZ) FROM authenticated;
