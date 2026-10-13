-- Admin call sheet (admin → Call approvals → Call sheet): what the host learns on a borrower's onboarding
-- call, saved to that borrower — the questions the team used to fill in on the Fillout "Screening
-- Questions" form (name, role, Facebook / TikTok, how they found us, how they'd use the loan, which
-- exchange, and the three things the host must cover: cash in / cash out, the repayment rules, adding
-- Emma Moodeng and Voices Against Unfair Loan), plus the host's notes, red flags and a 1–5 score.
--
-- One sheet per borrower per call (call_starts_at; NULL for an approval with no call). Admins only.

CREATE TABLE IF NOT EXISTS public.call_screenings (
   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
   user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
   call_starts_at timestamptz,
   meeting_id text,
   answers jsonb NOT NULL DEFAULT '{}'::jsonb,
   notes text,
   red_flags text,
   score smallint CHECK (score BETWEEN 1 AND 5),
   created_by uuid DEFAULT auth.uid(),
   updated_by uuid DEFAULT auth.uid(),
   created_at timestamptz NOT NULL DEFAULT now(),
   updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS call_screenings_one_per_call
   ON public.call_screenings (user_id, coalesce(call_starts_at, 'epoch'::timestamptz));
CREATE INDEX IF NOT EXISTS call_screenings_user_idx ON public.call_screenings (user_id, updated_at DESC);

ALTER TABLE public.call_screenings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.call_screenings FROM anon;
DROP POLICY IF EXISTS call_screenings_admin_all ON public.call_screenings;
CREATE POLICY call_screenings_admin_all ON public.call_screenings FOR ALL TO authenticated
   USING (app_private.is_moodeng_admin()) WITH CHECK (app_private.is_moodeng_admin());
