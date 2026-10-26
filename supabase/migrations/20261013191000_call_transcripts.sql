-- Zoom call transcripts + AI risk summary (admin → Call approvals → Call sheet). When a recorded Zoom
-- call's audio transcript is ready, Zoom sends "recording.transcript_completed" to zoom-webhook (with a
-- one-day download token); the function downloads the transcript, matches it to the borrower whose call
-- it was (users.video_call_meeting_id + start time), saves it here, and asks DeepSeek for a short risk
-- summary from the transcript, the borrower's bio and the host's call sheet. Admins only.

CREATE TABLE IF NOT EXISTS public.call_transcripts (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
   meeting_id text NOT NULL,
   meeting_uuid text NOT NULL UNIQUE,
   call_started_at timestamptz,
   host text,
   transcript text NOT NULL,
   received_at timestamptz NOT NULL DEFAULT now(),
   summary jsonb,
   risk_level text CHECK (risk_level IN ('low', 'medium', 'high')),
   summary_model text,
   summarized_at timestamptz,
   summary_error text
);
CREATE INDEX IF NOT EXISTS call_transcripts_user_idx ON public.call_transcripts (user_id, call_started_at DESC);

ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.call_transcripts FROM anon;
DROP POLICY IF EXISTS call_transcripts_admin_read ON public.call_transcripts;
CREATE POLICY call_transcripts_admin_read ON public.call_transcripts FOR SELECT TO authenticated USING (app_private.is_moodeng_admin());
