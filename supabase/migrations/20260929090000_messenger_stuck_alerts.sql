-- Team alert when a borrower's Facebook (Messenger) confirmation stalls.
--
-- Some phones never pass the m.me link on to the SendPulse bot, so the borrower sits on the contact
-- step and nobody knows unless they happen to open the Page inbox (Aya, Merry, joanni and Brian,
-- 2026-09-26..29). The messenger-stuck-alerts function (every 5 min) finds codes left unconfirmed
-- for 10+ minutes and posts a card to the KYC Telegram group with a "Mark Facebook verified"
-- button, plus a line in Discord #kyc.
--
-- users.messenger_stuck_alerted_at keeps it to one ping per borrower per day, however many times
-- they retry (each retry replaces their open code, so the code row can't carry it).

-- 1) Alert stamp ----------------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS messenger_stuck_alerted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.messenger_stuck_alerted_at IS
   'Last time messenger-stuck-alerts told the team this borrower could not confirm Facebook Messenger. Server-only.';

-- 2) Privileged-column guard ------------------------------------------------------------------------
-- Re-declared from the deployed body (pg_get_functiondef, 2026-09-29; identical to
-- 20260924150000) — see the LESSON in 20260811020000. Adds messenger_stuck_alerted_at, so a
-- borrower can't silence their own team alert through the REST API.
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
     -- Stuck-confirmation team alert (this migration).
     OR new.messenger_stuck_alerted_at IS DISTINCT FROM old.messenger_stuck_alerted_at
     -- Connect → Approve → Apply gate (20260924150000).
     OR new.loan_access_status IS DISTINCT FROM old.loan_access_status
     OR new.loan_access_approved_at IS DISTINCT FROM old.loan_access_approved_at
     -- Video-call booking + attendance (20260924150000).
     OR new.video_call_scheduled_at IS DISTINCT FROM old.video_call_scheduled_at
     OR new.video_call_starts_at IS DISTINCT FROM old.video_call_starts_at
     OR new.video_call_host IS DISTINCT FROM old.video_call_host
     OR new.video_call_booking_uid IS DISTINCT FROM old.video_call_booking_uid
     OR new.video_call_reminder_stage IS DISTINCT FROM old.video_call_reminder_stage
     OR new.video_call_confirm_token IS DISTINCT FROM old.video_call_confirm_token
     OR new.video_call_confirmed_at IS DISTINCT FROM old.video_call_confirmed_at
     OR new.video_call_outcome IS DISTINCT FROM old.video_call_outcome
     OR new.video_call_outcome_at IS DISTINCT FROM old.video_call_outcome_at
     OR new.video_call_join_url IS DISTINCT FROM old.video_call_join_url
     OR new.video_call_meeting_id IS DISTINCT FROM old.video_call_meeting_id
     OR new.video_call_arrived_at IS DISTINCT FROM old.video_call_arrived_at
     OR new.video_call_joined_at IS DISTINCT FROM old.video_call_joined_at
     OR new.video_call_left_at IS DISTINCT FROM old.video_call_left_at
     OR new.video_call_keep_spot_asked_at IS DISTINCT FROM old.video_call_keep_spot_asked_at
     -- Referral (gate bypass as of 20260924150000).
     OR new.redeemed_referral_code_id IS DISTINCT FROM old.redeemed_referral_code_id
     OR new.referral_boost_amount IS DISTINCT FROM old.referral_boost_amount
  THEN
    RAISE EXCEPTION 'users: verification/credit columns can only be written by verified server-side code';
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 3) Schedule ---------------------------------------------------------------------------------------
-- Same pattern as video-call-reminders: pg_net POST with the service key from Vault.
DO $$
BEGIN
  PERFORM cron.unschedule('messenger-stuck-alerts-5min');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'messenger-stuck-alerts-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/messenger-stuck-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
