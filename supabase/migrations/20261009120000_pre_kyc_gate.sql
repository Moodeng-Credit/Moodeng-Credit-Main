-- Pre-KYC gate: borrowers connect Messenger, book a call and get approved after it BEFORE they
-- can start a paid KYC session (Didit liveness / combined / id). Reuses the loan-access gate
-- (users.loan_access_status, loan_access_requests, Telegram Showed up / No-show) — it just sits in
-- front of KYC now, independent of telegram_bot_settings.loan_flow.
--
-- Who is gated (one rule, used by create-didit-session, loan-access, videoCallOutcome and the app):
--   kyc_gate switch on  AND  not a lender  AND  not KYC-verified  AND  not approved  AND  never had a loan
--   AND  no ID check already waiting on Didit (processing / in review).
-- So grandfathered (approved) accounts, verified accounts and anyone who has borrowed are never gated.
--
-- Switch: telegram_bot_settings.kyc_gate = 'on' | 'off' (Telegram /kycgate on|off). 'off' = old flow.

INSERT INTO public.telegram_bot_settings (key, value)
VALUES ('kyc_gate', 'on')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_kyc_gate()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT value FROM public.telegram_bot_settings WHERE key = 'kyc_gate'), 'on') = 'on';
$$;

REVOKE ALL ON FUNCTION public.get_kyc_gate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kyc_gate() TO anon, authenticated, service_role;

-- is_world_id_passport isn't on every deployed database (see 20260803000000), so it's read via
-- to_jsonb rather than named directly.
CREATE OR REPLACE FUNCTION public.needs_pre_kyc_gate(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_kyc_gate()
     AND u.user_role IS DISTINCT FROM 'lender'
     AND u.is_didit IS DISTINCT FROM 'ACTIVE'
     AND u.is_world_id IS DISTINCT FROM 'ACTIVE'
     AND (to_jsonb(u) ->> 'is_world_id_passport') IS DISTINCT FROM 'ACTIVE'
     AND u.loan_access_status IS DISTINCT FROM 'approved'
     -- A past borrower (a funded loan) is never gated; an unfunded request alone doesn't count, or
     -- inserting a request would be a way around the gate.
     AND NOT EXISTS (SELECT 1 FROM public.loans l WHERE l.borrower_user_id = u.id AND l.funded_at IS NOT NULL)
     -- ID already with Didit, no verdict yet (processing / in review): already paid for, so not
     -- gated — same as the app's usePreKycGate (getVerificationUiState review / processing).
     AND NOT (lower(coalesce(u.didit_id_status, '')) LIKE '%review%'
              OR (u.didit_submitted_at IS NOT NULL
                  AND lower(coalesce(u.didit_id_status, '')) NOT IN
                      ('duplicate', 'declined', 'abandoned', 'expired', 'not started', 'in progress')))
  FROM public.users u
  WHERE u.id = p_user_id;
$$;

-- Supabase grants new functions to anon/authenticated by default; revoking PUBLIC alone leaves those.
REVOKE ALL ON FUNCTION public.needs_pre_kyc_gate(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.needs_pre_kyc_gate(UUID) TO service_role;

-- The app's view of the same rule, for the signed-in user only.
CREATE OR REPLACE FUNCTION public.my_pre_kyc_gate()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.needs_pre_kyc_gate(auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.my_pre_kyc_gate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_pre_kyc_gate() TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- KYC tries: 3 declined attempts, then the borrower has to message us (an admin gives 3 more with
-- Telegram /kycretry @username). Counts DECLINED RESULTS, not sessions: /verify creates a Didit
-- session in the background while the borrower reads the prep screen, so counting sessions would
-- burn tries on people who only looked. One row per Didit session.
--   * ID / combined declines: this trigger on users.didit_id_status (webhook and sync both write it).
--   * Liveness declines (World ID path): written by didit-webhook / check-didit-status only when
--     Didit says "Declined" — liveness_status also reads DECLINED for an abandoned or expired scan,
--     which must not cost a try.
-- ---------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.kyc_declines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  didit_session_id  TEXT NOT NULL UNIQUE,
  kind              TEXT NOT NULL,            -- 'id' (didit_id_status) | 'liveness' (liveness_status)
  declined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at         TIMESTAMPTZ,              -- set by /kycretry: no longer counts
  voided_by         TEXT,
  cap_alerted_at    TIMESTAMPTZ               -- admins told this user is out of tries (once)
);

CREATE INDEX IF NOT EXISTS kyc_declines_user_idx ON public.kyc_declines (user_id) WHERE voided_at IS NULL;

-- Service role only (edge functions + the trigger below).
ALTER TABLE public.kyc_declines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kyc_declines FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_kyc_decline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(coalesce(new.didit_id_status, '')) = 'declined'
     AND lower(coalesce(old.didit_id_status, '')) IS DISTINCT FROM 'declined' THEN
    INSERT INTO public.kyc_declines (user_id, didit_session_id, kind)
    VALUES (new.id, coalesce(new.didit_session_id, 'id-' || gen_random_uuid()::text), 'id')
    ON CONFLICT (didit_session_id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.record_kyc_decline() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_record_kyc_decline ON public.users;
CREATE TRIGGER trg_record_kyc_decline
  AFTER UPDATE OF didit_id_status ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.record_kyc_decline();

-- Whoever is declined right now has used one try (their earlier history isn't recorded anywhere).
INSERT INTO public.kyc_declines (user_id, didit_session_id, kind)
SELECT id, 'backfill-' || id::text, 'id'
FROM public.users
WHERE lower(coalesce(didit_id_status, '')) = 'declined'
  AND is_didit IS DISTINCT FROM 'ACTIVE'
  AND is_world_id IS DISTINCT FROM 'ACTIVE'
ON CONFLICT (didit_session_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.kyc_tries_left(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT greatest(0, 3 - count(*)::int) FROM public.kyc_declines WHERE user_id = p_user_id AND voided_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.kyc_tries_left(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kyc_tries_left(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.my_kyc_tries_left()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.kyc_tries_left(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.my_kyc_tries_left() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_kyc_tries_left() TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- Daily onboarding check-in to the admin Telegram, 09:00 Manila (01:00 UTC): calls waiting on a
-- ✅ / ❌, and people who connected Messenger but have no call booked. Runs hourly until 12:00
-- Manila so a failed send is retried; loan-access sends it at most once a day
-- (telegram_bot_settings.gate_digest_date, set only after a successful send).
-- ---------------------------------------------------------------------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('loan-access-gate-digest-daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'loan-access-gate-digest-daily',
  '0 1-4 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-access',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{"action":"gate_digest"}'::jsonb
  )
  $$
);
