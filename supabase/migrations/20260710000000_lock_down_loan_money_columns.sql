-- Lock down loan payment/status/terms columns to service-role-only writes.
--
-- Previously repayment_status, repaid_amount, loan_status, hash, funded_at, repaid_at,
-- lender_user_id, lender_wallet — and the loan TERMS (total_repayment_amount, due_date,
-- loan_amount, borrower_wallet) — were writable by any authenticated user who owned the row
-- (the existing UPDATE policies only checked *which* row, not *which* columns or values), with
-- no check that a real USDC transfer had happened first. A user could call
-- supabase.from('loans').update({ repayment_status: 'Paid', ... }) directly and the row would
-- read fully repaid with zero money moved — or quietly rewrite the terms (see the terms block
-- below) to fake a full repayment for a fraction of a cent, or redirect a lender's funding.
--
-- The confirm-loan-payment edge function is now the only path allowed to write these columns:
-- it verifies the on-chain (or Base Pay bundler) transfer before writing anything, using the
-- service-role key. This trigger enforces that server-side, independent of RLS.
--
-- ROLE CHECK — why current_user, not auth.role():
--   A direct end-user API write runs as `authenticated` (or `anon`); the service-role key runs as
--   `service_role`; a manual desync-recovery write from the SQL editor/dashboard runs as `postgres`.
--   current_user reflects the actual execution role, so blocking only ('authenticated','anon')
--   allows every trusted path (service role edge fn, manual recovery, migrations) and blocks exactly
--   the client-facing direct writes. auth.role() is JWT-derived: if request.jwt.claims is absent in
--   the trigger context it returns NULL, which would WRONGLY block the service-role edge function.

CREATE TABLE used_payment_hashes (
  hash TEXT PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES loans(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE used_payment_hashes ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service-role key (used by the edge function) can touch this table.

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
     -- Interest return: the lender's refund of interest to the borrower. Now written only by the
     -- confirm-loan-payment 'return-interest' action after verifying the on-chain refund; previously
     -- the client wrote these directly, so a lender could mark interest returned without paying.
     OR NEW.interest_returned_at IS DISTINCT FROM OLD.interest_returned_at
     OR NEW.interest_return_hash IS DISTINCT FROM OLD.interest_return_hash
     -- Loan TERMS. These are set once at INSERT and never legitimately UPDATEd by the client
     -- (verified: no client .update() writes them). Locking them post-creation closes two exploits
     -- the status-column lock alone did NOT:
     --   * total_repayment_amount: a borrower could set it to 0.000001, send 1 micro-USDC, and the
     --     confirm-loan-payment isFullyRepaid check (compared against this value) would mark the loan
     --     PAID — principal kept, credit leveled up. ("pay any loan" surviving the money-column lock.)
     --   * due_date: rewriting it dodges the late-payment credit pause (gaming credit progression).
     --   * loan_amount: changes the funding target / repayment math after the fact.
     --   * borrower_wallet: combined with the "lender_user_id IS NULL" UPDATE policy, ANY user could
     --     rewrite an open request's payout wallet to their own and steal the next lender's funding
     --     (verifyPayment only checks the transfer landed on borrower_wallet). See the RLS follow-up.
     OR NEW.total_repayment_amount IS DISTINCT FROM OLD.total_repayment_amount
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.loan_amount IS DISTINCT FROM OLD.loan_amount
     OR NEW.borrower_wallet IS DISTINCT FROM OLD.borrower_wallet
  THEN
    RAISE EXCEPTION 'loans: payment/status/terms columns can only be written by a verified server-side confirmation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_loan_money_columns ON loans;
CREATE TRIGGER trg_enforce_loan_money_columns
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION enforce_loan_money_columns_service_role_only();

-- RLS follow-up: close the "anyone can edit any open request" surface.
-- The old policy allowed UPDATE when (lender_user_id = auth.uid() OR lender_user_id IS NULL). The
-- IS NULL branch let ANY authenticated user update ANY unfunded loan request (someone else's), which
-- — together with the now-locked terms columns above — was the second half of the funding-redirect
-- hole. Funding no longer happens via a client UPDATE at all (the confirm-loan-payment Edge Function
-- claims the loan with the service-role key, bypassing RLS), so the IS NULL branch is now pure attack
-- surface. Restrict the policy to loans the caller actually funded (their post-funding interest-return
-- write still works; a random user can no longer touch open requests).
DROP POLICY IF EXISTS "Lenders can update loans they fund" ON loans;
CREATE POLICY "Lenders can update loans they fund" ON loans
  FOR UPDATE TO authenticated
  USING (lender_user_id = auth.uid());
