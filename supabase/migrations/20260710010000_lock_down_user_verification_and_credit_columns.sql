-- Lock down user verification + credit columns to server-side writers only (Phases 2 + 3).
--
-- The "Users can update own data" policy is FOR UPDATE USING (auth.uid() = id) with no WITH CHECK
-- and no column restriction, so any signed-in user could set their OWN:
--   * is_world_id = 'ACTIVE'  → self-verify (bypass World ID / Didit)  ← John's "verify whatever I want"
--   * cs = <anything>         → self-raise credit limit                ← John's "set limits to whatever I want"
--   * mal / nal / *_status    → self-grant loan capacity / verification state
-- ...by calling supabase.from('users').update({...}) directly.
--
-- These columns are authoritative and only ever legitimately written server-side:
--   * verification (is_world_id/is_didit/liveness_*/nullifier_hash): verify-worldid, didit-webhook,
--     check-didit-status Edge Functions (service role).
--   * credit (cs/mal/nal/credit_progression_paused): confirm-loan-payment Edge Function (service
--     role) and redeem_referral_code (a SECURITY DEFINER function).
--   * risk (current_risk_score/current_risk_band/risk_computed_at): compute_risk_score (a SECURITY
--     DEFINER function). Without this, a client could self-set current_risk_band='low' to forge a
--     favorable risk assessment — same exploit class as a forged credit limit.
--   * moderation (account_status): admin actions only. Without this, a banned user self-unbans.
--
-- ROLE CHECK — why current_user, not auth.role():
--   A direct end-user API write runs as the `authenticated` (or `anon`) role. The service-role key
--   runs as `service_role`. A SECURITY DEFINER function (e.g. redeem_referral_code) runs as its
--   OWNER (postgres) — but auth.role() still returns 'authenticated' there (it reads the caller's
--   JWT, not the execution context), so an auth.role() check would WRONGLY block referral redemption.
--   current_user reflects the execution role, so blocking only ('authenticated','anon') allows every
--   trusted path (service role, definer functions, migrations, dashboard) and blocks exactly the
--   client-facing direct writes.
--
-- IMPORTANT — this function MUST be SECURITY INVOKER (not DEFINER): inside a SECURITY DEFINER
--   function current_user resolves to the OWNER (postgres), so the guard would always be true and the
--   trigger would NEVER block anything. INVOKER makes current_user reflect the real caller. And note
--   redeem_referral_code/compute_risk_score (themselves SECURITY DEFINER, owner postgres) still pass:
--   inside them current_user is already postgres when this INVOKER trigger fires. Do NOT change to DEFINER.

CREATE OR REPLACE FUNCTION enforce_user_privileged_columns_server_only()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.is_world_id IS DISTINCT FROM OLD.is_world_id
     OR NEW.is_didit IS DISTINCT FROM OLD.is_didit
     OR NEW.liveness_status IS DISTINCT FROM OLD.liveness_status
     OR NEW.liveness_session_id IS DISTINCT FROM OLD.liveness_session_id
     OR NEW.nullifier_hash IS DISTINCT FROM OLD.nullifier_hash
     OR NEW.cs IS DISTINCT FROM OLD.cs
     OR NEW.mal IS DISTINCT FROM OLD.mal
     OR NEW.nal IS DISTINCT FROM OLD.nal
     OR NEW.credit_progression_paused IS DISTINCT FROM OLD.credit_progression_paused
     OR NEW.current_risk_score IS DISTINCT FROM OLD.current_risk_score
     OR NEW.current_risk_band IS DISTINCT FROM OLD.current_risk_band
     OR NEW.risk_computed_at IS DISTINCT FROM OLD.risk_computed_at
     -- Moderation state. account_status ('active'|'blocked'|'banned') is written ONLY by admin
     -- actions / SECURITY DEFINER triggers (20260507010000), never by the client. Without this lock
     -- a 'banned' user could supabase.from('users').update({ account_status: 'active' }) and lift
     -- their own ban — the "update own data" policy has no WITH CHECK and no column restriction.
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
  THEN
    RAISE EXCEPTION 'users: verification/credit columns can only be written by verified server-side code';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_user_privileged_columns ON users;
CREATE TRIGGER trg_enforce_user_privileged_columns
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_user_privileged_columns_server_only();
