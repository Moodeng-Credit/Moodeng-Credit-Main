-- Store the Loan Note listing transaction hash distinctly from the funding/mint tx.
--
-- The smart-contract funding flow makes two on-chain calls: createAndFundLoan (mint, whose
-- hash is appended to loans.hash[]) and listLoanNote (escrow listing). The listing tx is
-- recorded here so the mint and list transactions are individually traceable. The sale
-- price itself is stored in loans.listing_price (defaults to principal).
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS listing_tx_hash TEXT;

COMMENT ON COLUMN loans.listing_tx_hash IS
  'Transaction hash of listLoanNote (escrow listing). Distinct from hash[] (funding/mint tx) and listing_price (sale price).';
