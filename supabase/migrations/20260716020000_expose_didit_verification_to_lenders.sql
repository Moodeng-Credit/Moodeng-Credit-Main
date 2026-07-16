-- Re-expose Didit verification status through public_user_profiles so lenders see
-- Didit-verified borrowers as "Verified".
--
-- isUserVerified() (src/lib/isUserVerified.ts) treats World ID *or* Didit as verified,
-- and getVerificationUiState() derives the "Pending / In review / Unfinished" states from
-- didit_submitted_at + didit_id_status. But the public_user_profiles view (the PII-safe view
-- lenders read every borrower through) passed is_world_id through while hard-nulling the entire
-- Didit column set. Result: every Didit-verified borrower (the majority path — 6 of 7 verified
-- borrowers at time of writing) rendered as "Not Verified" on the lender request board.
--
-- Didit is the same low-sensitivity verification enum as the already-exposed is_world_id, so
-- surfacing it introduces no new PII. Session IDs, decline reasons, and liveness internals stay
-- NULL — lenders only need the verified/pending signal, not the raw KYC session details.

CREATE OR REPLACE VIEW public.public_user_profiles
WITH (security_invoker = false) AS
SELECT
  id,
  NULL::text                    AS wallet_address,
  username,
  NULL::text                    AS email,
  NULL::text                    AS google_id,
  NULL::bigint                  AS telegram_id,
  NULL::text                    AS telegram_username,
  NULL::bigint                  AS chat_id,
  is_world_id,
  NULL::text                    AS nullifier_hash,
  NULL::integer                 AS mal,
  NULL::integer                 AS nal,
  NULL::integer                 AS cs,
  NULL::text                    AS reset_token,
  NULL::timestamptz             AS reset_token_expiry,
  created_at,
  updated_at,
  NULL::boolean                 AS credit_progression_paused,
  user_role,
  NULL::public.account_status   AS account_status,
  NULL::uuid                    AS redeemed_referral_code_id,
  NULL::numeric                 AS referral_boost_amount,
  NULL::text                    AS wallet_provider,
  NULL::text                    AS wallet_connector_name,
  NULL::integer                 AS wallet_chain_id,
  NULL::timestamptz             AS wallet_connected_at,
  NULL::integer                 AS current_risk_score,
  NULL::text                    AS current_risk_band,
  NULL::timestamptz             AS risk_computed_at,
  display_name,
  income_type,
  payday_type,
  payday_start,
  payday_end,
  gap_reasons,
  NULL::boolean                 AS notif_account_activity,
  NULL::boolean                 AS notif_transaction_activity,
  NULL::boolean                 AS notif_blogs,
  profession,
  NULL::text                    AS location,
  other_income,
  monthly_income,
  monthly_expenses,
  NULL::text                    AS is_veriff,
  NULL::text                    AS income_description,
  is_didit,
  NULL::text                    AS liveness_status,
  NULL::text                    AS liveness_session_id,
  NULL::text                    AS line_id,
  didit_submitted_at,
  didit_id_status,
  NULL::text                    AS didit_decline_reason,
  NULL::text                    AS didit_session_id,
  NULL::text                    AS didit_session_url,
  NULL::text                    AS didit_notify_marker
FROM public.users;

GRANT SELECT ON public.public_user_profiles TO anon, authenticated;
