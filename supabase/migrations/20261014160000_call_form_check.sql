-- Call form check (admin → Call approvals → Call sheet): when a recorded call's transcript comes in,
-- DeepSeek fills in its own copy of the Screening Questions form from the call and compares it with the
-- host's (supabase/functions/_shared/callFormCheck.ts). Saved next to the transcript; the call sheet shows
-- ✓ match / ⚠ differs / ➕ heard on the call per question. form_check_screening_at is the host form's
-- updated_at that was compared, so the sheet can tell when the host has edited since.

ALTER TABLE public.call_transcripts
   ADD COLUMN IF NOT EXISTS form_check jsonb,
   ADD COLUMN IF NOT EXISTS form_checked_at timestamptz,
   ADD COLUMN IF NOT EXISTS form_check_screening_at timestamptz,
   ADD COLUMN IF NOT EXISTS form_check_error text;
