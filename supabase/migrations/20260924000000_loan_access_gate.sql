-- Connect → Approve → Apply: a borrower must reach out to us and be manually approved (once, per
-- user) before they can post a loan request.
--
-- Which borrower flow is live is a switch, flipped by an admin from Telegram (/loanflow):
--   open      today's flow — no gate; a borrower without a referral books a video call and their
--             request posts immediately. (Default, so applying this changes nothing by itself.)
--   call      "post only after the call": reach out on Messenger + book a video call; an admin taps
--             ✅ Showed up (→ approved, can apply) or ❌ No-show (→ must rebook) after the call.
--   approval  reach out on Messenger; an admin approves/rejects in Telegram — no call.
-- The gate below (loan_access_status + the loans insert guard) only bites in call/approval. It
-- applies to referred borrowers too: their call is a setup call with Emma (local exchange — how to
-- deposit, cash out and repay), and their request can only exist after she marks them attended.
--
--   none      → never reached out (or a pending request expired)
--   pending   → reached out via the in-app "Let's connect" card; admins pinged on Telegram/Discord
--   approved  → may apply for loans from now on (no re-approval per loan)
--   rejected  → turned down; may reach out again, which goes back to pending
--
-- Flow: the loan-access edge function (action=submit) flips none/rejected → pending and pings the
-- admin Telegram channel with Approve/Reject buttons; telegram-webhook applies the decision and
-- notifies the borrower (push + Telegram). A 7-day cron (loan-access action=expire) returns stale
-- pending requests to none with a nudge.
--
-- Everyone who exists today is grandfathered to approved, so nothing changes for current users.
-- See docs/HANDOFF_BORROWER_VERIFICATION.md §13.

-- 1) Per-user gate -------------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.loan_access_status AS ENUM ('none', 'pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Grandfather: everyone who exists right now keeps applying exactly as before. Done with column
-- defaults rather than an UPDATE: ADD COLUMN ... DEFAULT fills existing rows as metadata only — no
-- table rewrite, no row triggers, and users.updated_at isn't bumped for every account. Seen is
-- stamped too, so nobody gets a surprise "you're approved!" glow for something they already had.
-- The defaults are then switched so accounts created from here on start at 'none' / NULL.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS loan_access_status public.loan_access_status NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS loan_access_approved_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS loan_access_seen_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.users
  ALTER COLUMN loan_access_status SET DEFAULT 'none',
  ALTER COLUMN loan_access_approved_at DROP DEFAULT,
  ALTER COLUMN loan_access_seen_at DROP DEFAULT;

COMMENT ON COLUMN public.users.loan_access_status IS
  'Connect → Approve → Apply gate. Only approved borrowers can insert loans. Server-written only (privileged-column guard).';
COMMENT ON COLUMN public.users.loan_access_approved_at IS
  'When an admin approved this borrower (or when they were grandfathered in).';
COMMENT ON COLUMN public.users.loan_access_seen_at IS
  'When the borrower first saw the "you''re approved" glow. Client-writable — only drives a one-time highlight.';

-- 2) One row per reach-out -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.loan_access_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  reason        TEXT,
  -- Referral code typed on the referral card. Kept so Part 2 (Apply) can pre-fill it days later,
  -- when the borrower is approved. It's a credit boost only — never a bypass of this gate.
  referral_code TEXT,
  channel       TEXT NOT NULL CHECK (channel IN ('messenger', 'whatsapp')),
  -- 'call' requests are decided by attendance (Showed up / No-show); 'approval' ones directly.
  kind          TEXT NOT NULL DEFAULT 'approval' CHECK (kind IN ('approval', 'call')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'no_show', 'expired')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  decided_at    TIMESTAMPTZ,
  decided_by    TEXT -- admin's Telegram handle (or 'cron' for expiry)
);

COMMENT ON TABLE public.loan_access_requests IS
  'Connect → Approve → Apply: one row per borrower reach-out. Written only by the loan-access / telegram-webhook edge functions (service role).';

CREATE UNIQUE INDEX IF NOT EXISTS loan_access_requests_one_open_per_user
  ON public.loan_access_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS loan_access_requests_pending_expiry
  ON public.loan_access_requests (expires_at) WHERE status = 'pending';

ALTER TABLE public.loan_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Borrowers read own loan access requests" ON public.loan_access_requests;
CREATE POLICY "Borrowers read own loan access requests"
  ON public.loan_access_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- No insert/update/delete policies: all writes go through the service role.

-- 3) Video-call attendance + Messenger confirm -------------------------------------------------
-- Reset on every new booking by calcom-round-robin. The confirm token rides in the "✅ I'll be
-- there" button of the Messenger reminder (video-call-confirm edge function).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS video_call_confirm_token TEXT,
  ADD COLUMN IF NOT EXISTS video_call_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS video_call_outcome TEXT CHECK (video_call_outcome IN ('attended', 'no_show')),
  ADD COLUMN IF NOT EXISTS video_call_outcome_at TIMESTAMPTZ,
  -- The borrower's IANA time zone at booking, so reminders show the time the way they saw it.
  ADD COLUMN IF NOT EXISTS video_call_timezone TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_video_call_confirm_token_key
  ON public.users (video_call_confirm_token) WHERE video_call_confirm_token IS NOT NULL;

-- 4) The flow switch -----------------------------------------------------------------------------
INSERT INTO public.telegram_bot_settings (key, value)
VALUES ('loan_flow', 'open')
ON CONFLICT (key) DO NOTHING;

-- Readable by the app (telegram_bot_settings itself holds chat ids, so it stays private).
-- Anything unexpected reads as 'open' — the flow that never locks anyone out.
CREATE OR REPLACE FUNCTION public.get_loan_flow()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN value IN ('open', 'call', 'approval') THEN value ELSE 'open' END
  FROM (SELECT (SELECT value FROM public.telegram_bot_settings WHERE key = 'loan_flow') AS value) s;
$$;

REVOKE ALL ON FUNCTION public.get_loan_flow() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_loan_flow() TO anon, authenticated;

-- 5) Privileged-column guard ---------------------------------------------------------------------
-- Re-declared from the deployed body (pg_get_functiondef, 2026-09-24) — see the LESSON in
-- 20260811020000. Adds:
--   * loan_access_status / loan_access_approved_at — client-writable would mean self-approval.
--   * whatsapp_verified_at / messenger_verified_at / messenger_psid — these were never guarded, so
--     a signed-in user could stamp their own "verified" contact line through the REST API.
--   * video_call_* — same hole: a user could mark their own call as booked (skipping the video-call
--     step) or, now, as attended. Only calcom-round-robin / calcom-webhook / admins write these.
--   * redeemed_referral_code_id / referral_boost_amount — a referral decides who hosts the call and
--     carries a credit boost, so a user must not be able to set their own. Only redeem_referral_code
--     (SECURITY DEFINER) writes them.
-- loan_access_seen_at stays client-writable on purpose (the app stamps it when the glow is seen).
CREATE OR REPLACE FUNCTION public.enforce_user_privileged_columns_server_only()
RETURNS trigger AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN new;
  END IF;

  IF new.is_world_id IS DISTINCT FROM old.is_world_id
     OR new.is_didit IS DISTINCT FROM old.is_didit
     OR new.liveness_status IS DISTINCT FROM old.liveness_status
     OR new.liveness_session_id IS DISTINCT FROM old.liveness_session_id
     OR new.nullifier_hash IS DISTINCT FROM old.nullifier_hash
     OR new.cs IS DISTINCT FROM old.cs
     OR new.mal IS DISTINCT FROM old.mal
     OR new.nal IS DISTINCT FROM old.nal
     OR new.credit_progression_paused IS DISTINCT FROM old.credit_progression_paused
     OR new.current_risk_score IS DISTINCT FROM old.current_risk_score
     OR new.current_risk_band IS DISTINCT FROM old.current_risk_band
     OR new.risk_computed_at IS DISTINCT FROM old.risk_computed_at
     OR new.account_status IS DISTINCT FROM old.account_status
     OR new.is_veriff IS DISTINCT FROM old.is_veriff
     OR new.didit_id_status IS DISTINCT FROM old.didit_id_status
     OR new.wallet_face_status IS DISTINCT FROM old.wallet_face_status
     OR new.wallet_face_session_id IS DISTINCT FROM old.wallet_face_session_id
     OR new.wallet_face_checked_at IS DISTINCT FROM old.wallet_face_checked_at
     -- Cash-out gate exemption (20260820110000). Client-writable would mean self-release.
     OR new.cashout_gate_exempt IS DISTINCT FROM old.cashout_gate_exempt
     -- Proven contact lines (20260921000000 / 20260922000000). Only the webhooks may stamp these.
     OR new.whatsapp_verified_at IS DISTINCT FROM old.whatsapp_verified_at
     OR new.messenger_verified_at IS DISTINCT FROM old.messenger_verified_at
     OR new.messenger_psid IS DISTINCT FROM old.messenger_psid
     -- Connect → Approve → Apply gate (this migration).
     OR new.loan_access_status IS DISTINCT FROM old.loan_access_status
     OR new.loan_access_approved_at IS DISTINCT FROM old.loan_access_approved_at
     -- Video-call booking + attendance (this migration).
     OR new.video_call_scheduled_at IS DISTINCT FROM old.video_call_scheduled_at
     OR new.video_call_starts_at IS DISTINCT FROM old.video_call_starts_at
     OR new.video_call_host IS DISTINCT FROM old.video_call_host
     OR new.video_call_booking_uid IS DISTINCT FROM old.video_call_booking_uid
     OR new.video_call_reminder_stage IS DISTINCT FROM old.video_call_reminder_stage
     OR new.video_call_confirm_token IS DISTINCT FROM old.video_call_confirm_token
     OR new.video_call_confirmed_at IS DISTINCT FROM old.video_call_confirmed_at
     OR new.video_call_outcome IS DISTINCT FROM old.video_call_outcome
     OR new.video_call_outcome_at IS DISTINCT FROM old.video_call_outcome_at
     -- Referral (gate bypass as of this migration).
     OR new.redeemed_referral_code_id IS DISTINCT FROM old.redeemed_referral_code_id
     OR new.referral_boost_amount IS DISTINCT FROM old.referral_boost_amount
  THEN
    RAISE EXCEPTION 'users: verification/credit columns can only be written by verified server-side code';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 6) Server-side enforcement: a loan request can only come from an approved borrower -------------
-- The UI gate is a convenience; this is the rule — in the call/approval flows. In 'open' it stands
-- down, exactly like today. Only client inserts are checked (service-role / admin tooling passes
-- through), mirroring the privileged-column guard. SECURITY INVOKER for the same reason:
-- current_user must be the caller's role (get_loan_flow is DEFINER, so it can read the setting).
CREATE OR REPLACE FUNCTION public.enforce_loan_access_approved()
RETURNS trigger AS $$
DECLARE
  v_status public.loan_access_status;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR new.borrower_user_id IS NULL THEN
    RETURN new;
  END IF;

  IF public.get_loan_flow() = 'open' THEN
    RETURN new;
  END IF;

  SELECT loan_access_status INTO v_status FROM public.users WHERE id = new.borrower_user_id;

  IF v_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'loan_access_not_approved: connect with the Moodeng team and get approved before requesting a loan'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_loan_access_approved ON public.loans;
CREATE TRIGGER trg_enforce_loan_access_approved
  BEFORE INSERT ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.enforce_loan_access_approved();

-- 7) Referral redemptions: a log + a Telegram/Discord alert per redemption ------------------------
-- A referral now skips the strong filter, so admins want to see every code as it's used (who, which
-- code). redeem_referral_code stamps users.redeemed_referral_code_id; this trigger logs it once per
-- user and asks the loan-access function (action=referral_alert) to post the alert. The log row is
-- also the dedupe: the function only alerts for a row not yet alerted, so calling it twice — or
-- calling it without a real redemption — sends nothing.
CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  user_id          UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  referral_code_id UUID REFERENCES public.referral_codes(id) ON DELETE SET NULL,
  code             TEXT,
  redeemed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  alerted_at       TIMESTAMPTZ
);
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

CREATE OR REPLACE FUNCTION private.log_referral_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  project_url TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1);
  service_key TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1);
BEGIN
  INSERT INTO public.referral_redemptions (user_id, referral_code_id, code)
  VALUES (new.id, new.redeemed_referral_code_id, (SELECT rc.code FROM public.referral_codes rc WHERE rc.id = new.redeemed_referral_code_id))
  ON CONFLICT (user_id) DO NOTHING;

  IF project_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := project_url || '/functions/v1/loan-access',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
      body := jsonb_build_object('action', 'referral_alert', 'userId', new.id)
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS log_referral_redemption ON public.users;
CREATE TRIGGER log_referral_redemption
  AFTER UPDATE OF redeemed_referral_code_id ON public.users
  FOR EACH ROW
  WHEN (new.redeemed_referral_code_id IS NOT NULL AND old.redeemed_referral_code_id IS DISTINCT FROM new.redeemed_referral_code_id)
  EXECUTE FUNCTION private.log_referral_redemption();

-- 8) Expire stale pending requests (7 days) with a nudge — hourly --------------------------------
DO $$
BEGIN
  PERFORM cron.unschedule('loan-access-expire-hourly');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'loan-access-expire-hourly',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/loan-access',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{"action":"expire"}'::jsonb
  )
  $$
);
