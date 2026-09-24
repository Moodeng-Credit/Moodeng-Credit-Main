-- Client-confirmed counterpart to the (unused, plan-gated) Calendly webhook: Calendly's Webhooks
-- API needs a paid Standard-tier org, which Moodeng isn't on. Instead the borrower books inside
-- an inline Calendly embed in the app; the moment Calendly's widget fires its own
-- `calendly.event_scheduled` postMessage event, the client calls this RPC to record it.
--
-- This is honest about its limitation: it's the *caller* asserting their own booking happened,
-- not an independent third-party confirmation like the WhatsApp webhook. The blast radius of
-- someone lying to it is bounded and low-stakes — they'd only be skipping a call Moodeng expects
-- them to show up to, which is caught the normal way (a no-show), not unlocking money or bypassing
-- KYC. SECURITY DEFINER only to reach past RLS on the borrower's own row; it still can't touch
-- anyone else's.
CREATE OR REPLACE FUNCTION public.mark_video_call_scheduled(
  p_host TEXT,
  p_starts_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_host NOT IN ('george', 'emma') THEN
    RAISE EXCEPTION 'Invalid host';
  END IF;

  UPDATE public.users
  SET video_call_scheduled_at = NOW(),
      video_call_host = p_host,
      video_call_starts_at = p_starts_at
  WHERE id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_video_call_scheduled(TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_video_call_scheduled(TEXT, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_video_call_scheduled(TEXT, TIMESTAMPTZ) TO authenticated;
