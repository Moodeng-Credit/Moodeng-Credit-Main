-- Extend the client-write locks to the Loan-Note columns (and two residual user flags).
--
-- Follow-up to 20260710000000 (loans money/terms lock) and the users verification/credit lock.
-- Those triggers ENUMERATE the columns they block, so any sensitive column added by a LATER
-- migration is unprotected until it's added here. Two such gaps were found in the 2026-07-11
-- security audit:
--
--   1. loans — the Loan-Note / Liquidity-Relay columns added by 20260710080000 + 20260710090000
--      (funding_method, onchain_loan_id, onchain_request_id, loan_note_owner_wallet, listing_price,
--      is_sellable, listing_tx_hash) were NOT in enforce_loan_money_columns_service_role_only.
--      The "Borrowers can update their loans" RLS policy is USING (borrower_user_id = auth.uid())
--      with no column filter, so a borrower could UPDATE their OWN loan row to set
--      is_sellable=true, funding_method='smart_contract', listing_price=<arbitrary> — self-
--      manufacturing a sellable Loan Note. Combined with buy-loan-note in mock mode (on-chain
--      checks skipped), that mints IOU points (= listing_price) and self-assigns lender status.
--      These columns are written legitimately ONLY by the service-role edge functions
--      admin-fund-loan (origination) and buy-loan-note (sale); the frontend only READS them
--      (src/lib/loanNotes/api.ts). Locking them to service-role breaks no client flow.
--
--   2. users — is_veriff (dormant; no reader/writer) and didit_id_status (written only by the
--      didit-webhook / check-didit-status / create-didit-session service-role functions; the
--      frontend only reads it for the badge sub-state) were not in
--      enforce_user_privileged_columns_server_only. didit_id_status is display-only — the real
--      "verified" gate (isUserVerified) reads the already-locked is_world_id/is_didit — so this
--      is defense-in-depth, closing cosmetic self-tampering of the verification badge.
--
-- ROLE CHECK / SECURITY INVOKER: unchanged from 20260710000000 — the guard blocks only the
--   ('authenticated','anon') execution roles; service-role edge fns run as service_role, manual
--   recovery as postgres, both bypass. The functions MUST stay SECURITY INVOKER so current_user
--   reflects the real caller (a SECURITY DEFINER function would resolve current_user to the owner
--   and never block anything). Do NOT change to SECURITY DEFINER.

CREATE OR REPLACE FUNCTION enforce_loan_money_columns_service_role_only()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.loan_status IS DISTINCT FROM OLD.loan_status
     OR NEW.repayment_status IS DISTINCT FROM OLD.repayment_status
     OR NEW.repaid_amount IS DISTINCT FROM OLD.repaid_amount
     OR NEW.funded_at IS DISTINCT FROM OLD.funded_at
     OR NEW.repaid_at IS DISTINCT FROM OLD.repaid_at
     OR NEW.hash IS DISTINCT FROM OLD.hash
     OR NEW.lender_user_id IS DISTINCT FROM OLD.lender_user_id
     OR NEW.lender_wallet IS DISTINCT FROM OLD.lender_wallet
     OR NEW.interest_returned_at IS DISTINCT FROM OLD.interest_returned_at
     OR NEW.interest_return_hash IS DISTINCT FROM OLD.interest_return_hash
     OR NEW.total_repayment_amount IS DISTINCT FROM OLD.total_repayment_amount
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.loan_amount IS DISTINCT FROM OLD.loan_amount
     OR NEW.borrower_wallet IS DISTINCT FROM OLD.borrower_wallet
     -- Loan-Note / Liquidity-Relay columns (added 20260710080000 + 20260710090000). Server-
     -- authoritative: written only by admin-fund-loan (origination) and buy-loan-note (sale).
     OR NEW.funding_method IS DISTINCT FROM OLD.funding_method
     OR NEW.onchain_loan_id IS DISTINCT FROM OLD.onchain_loan_id
     OR NEW.onchain_request_id IS DISTINCT FROM OLD.onchain_request_id
     OR NEW.loan_note_owner_wallet IS DISTINCT FROM OLD.loan_note_owner_wallet
     OR NEW.listing_price IS DISTINCT FROM OLD.listing_price
     OR NEW.is_sellable IS DISTINCT FROM OLD.is_sellable
     OR NEW.listing_tx_hash IS DISTINCT FROM OLD.listing_tx_hash
  THEN
    RAISE EXCEPTION 'loans: payment/status/terms/loan-note columns can only be written by a verified server-side confirmation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

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
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     -- Residual verification flags — written only by the Didit/Veriff service-role functions.
     OR NEW.is_veriff IS DISTINCT FROM OLD.is_veriff
     OR NEW.didit_id_status IS DISTINCT FROM OLD.didit_id_status
  THEN
    RAISE EXCEPTION 'users: verification/credit columns can only be written by verified server-side code';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;
