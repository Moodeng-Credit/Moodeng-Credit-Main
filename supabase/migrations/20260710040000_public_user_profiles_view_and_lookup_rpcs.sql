-- PII lockdown (additive phase). The `users` table is world-readable via "Public profiles are
-- viewable" USING(true), exposing EVERY column (email/wallet/cs/risk/nullifier/account_status) to the
-- anon key shipped in the frontend bundle. RLS is row-level only, so we can't column-restrict it.
--
-- This adds the SAFE building blocks so the frontend can stop reading other users' full rows; the
-- restrictive base-table policy change is a SEPARATE later migration (after the frontend is repointed
-- and login is verified). Applying THIS migration changes nothing on its own.
--
--   1. public_user_profiles: a view exposing ONLY safe display columns for cross-user reads
--      (username/display_name/user_role/is_world_id badge). Same column shape as `users` (sensitive
--      columns are literal NULLs) so mapSupabaseRowToUser and the generated types stay drop-in.
--      Owned by postgres with security_invoker OFF, so it reads all rows regardless of the base-table
--      RLS we tighten later — but only the safe columns can ever flow through it.
--   2. email_exists / get_user_id_by_username: replace the pre-login (anon) existence checks that
--      currently SELECT from users filtered by email/username. They return only a bool / uuid — no
--      other columns — and allow no more enumeration than the direct table reads they replace.

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
  NULL::text                    AS income_type,
  NULL::text                    AS payday_type,
  NULL::smallint                AS payday_start,
  NULL::smallint                AS payday_end,
  NULL::text[]                  AS gap_reasons,
  NULL::boolean                 AS notif_account_activity,
  NULL::boolean                 AS notif_transaction_activity,
  NULL::boolean                 AS notif_blogs,
  NULL::text                    AS profession,
  NULL::text                    AS location,
  NULL::text                    AS other_income,
  NULL::text                    AS monthly_income,
  NULL::text                    AS monthly_expenses,
  NULL::text                    AS is_veriff,
  NULL::text                    AS income_description,
  NULL::text                    AS is_didit,
  NULL::text                    AS liveness_status,
  NULL::text                    AS liveness_session_id,
  NULL::text                    AS line_id,
  NULL::timestamptz             AS didit_submitted_at,
  NULL::text                    AS didit_id_status,
  NULL::text                    AS didit_decline_reason,
  NULL::text                    AS didit_session_id,
  NULL::text                    AS didit_session_url,
  NULL::text                    AS didit_notify_marker
FROM public.users;

GRANT SELECT ON public.public_user_profiles TO anon, authenticated;

-- Pre-login existence/lookup checks as tightly-scoped SECURITY DEFINER RPCs (return only bool / uuid).
CREATE OR REPLACE FUNCTION public.email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE email = p_email);
$$;

CREATE OR REPLACE FUNCTION public.get_user_id_by_username(p_username text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE username = p_username LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.email_exists(text) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_username(text) FROM public;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_username(text) TO anon, authenticated;
