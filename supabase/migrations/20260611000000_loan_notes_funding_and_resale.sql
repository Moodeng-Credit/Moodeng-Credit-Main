-- Loan funding method + Loan Note resale support.
--
-- Adds funding metadata to `loans` (direct vs smart-contract funding, the on-chain
-- loanId / Loan Note token, listing price, sellability) and a `loan_note_purchases`
-- table recording lender purchases of Loan Notes from Moodeng. IOU points for lenders
-- are awarded via the existing award_points() RPC at purchase-recording time.

-- ---------------------------------------------------------------------------
-- loans: funding metadata
-- ---------------------------------------------------------------------------
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS funding_method TEXT
    CHECK (funding_method IN ('direct', 'smart_contract')),
  ADD COLUMN IF NOT EXISTS onchain_loan_id TEXT,
  ADD COLUMN IF NOT EXISTS onchain_request_id TEXT,
  ADD COLUMN IF NOT EXISTS loan_note_owner_wallet TEXT,
  ADD COLUMN IF NOT EXISTS listing_price DECIMAL(18, 6),
  ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN loans.funding_method IS
  'How the loan was funded: direct (manual USDC transfer, no Loan Note) or smart_contract (LoanManager, sellable Loan Note).';
COMMENT ON COLUMN loans.onchain_loan_id IS 'LoanManager loanId / ERC721 tokenId for smart-contract loans.';
COMMENT ON COLUMN loans.onchain_request_id IS 'bytes32 requestId used for on-chain origination idempotency.';
COMMENT ON COLUMN loans.loan_note_owner_wallet IS 'Current owner of the Loan Note (Moodeng until sold, then the lender).';
COMMENT ON COLUMN loans.listing_price IS 'USDC price Moodeng lists the Loan Note for (lender purchase price).';
COMMENT ON COLUMN loans.is_sellable IS 'True when a smart-contract loan has a Loan Note that can be purchased by a lender.';

CREATE INDEX IF NOT EXISTS idx_loans_onchain_loan_id ON loans(onchain_loan_id);
CREATE INDEX IF NOT EXISTS idx_loans_is_sellable ON loans(is_sellable) WHERE is_sellable = TRUE;

-- Uniqueness for on-chain request idempotency (mirrors contract requestIdUsed).
CREATE UNIQUE INDEX IF NOT EXISTS uq_loans_onchain_request_id
  ON loans(onchain_request_id) WHERE onchain_request_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- loan_note_purchases: lender purchases of Loan Notes from Moodeng
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loan_note_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  onchain_loan_id TEXT,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_wallet TEXT NOT NULL,
  price DECIMAL(18, 6) NOT NULL,
  tx_hash TEXT,
  iou_points_awarded BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One recorded purchase per loan (the Loan Note is a single NFT). Re-recording the
-- same loan purchase is rejected, keeping IOU awards idempotent alongside award_points.
CREATE UNIQUE INDEX IF NOT EXISTS uq_loan_note_purchases_loan ON loan_note_purchases(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_note_purchases_buyer ON loan_note_purchases(buyer_user_id);

ALTER TABLE loan_note_purchases ENABLE ROW LEVEL SECURITY;

-- Buyers can read their own purchases (for the "My Supported Loans" page).
DROP POLICY IF EXISTS "Buyers can read own loan note purchases" ON loan_note_purchases;
CREATE POLICY "Buyers can read own loan note purchases"
  ON loan_note_purchases
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_user_id);

-- Writes happen exclusively through the service-role edge function (buy-loan-note),
-- which bypasses RLS. No INSERT/UPDATE policy is granted to clients on purpose.
