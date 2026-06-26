-- Withdrawals: a borrower cashing out their funded-loan USDC to an off-ramp
-- exchange (Coins.ph, PDAX, Binance, GCrypto, Moneybees). Recorded as a
-- standalone row because a single cash-out can draw on the combined balance of
-- several funded loans, so it doesn't belong to one loan. Surfaced in the
-- borrower's transaction history next to their loans, and used to fire the
-- "your USDC is on its way" confirmation notification.
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(18, 6) NOT NULL,
  exchange TEXT NOT NULL,                 -- destination exchange label (e.g. "Coins.ph")
  destination_address TEXT NOT NULL,      -- the exchange deposit address the user sent to
  tx_hash TEXT NOT NULL,                  -- on-chain transfer hash (support reference)
  notified_at TIMESTAMPTZ,                -- set once the "on its way" notification is delivered (dedup)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_borrower ON withdrawals(borrower_user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created ON withdrawals(created_at);
-- One row per on-chain transfer — guards against a double-record if the client
-- retries the insert for the same broadcast.
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_tx_hash ON withdrawals(tx_hash);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- Borrowers read their own withdrawals (transaction-history view).
CREATE POLICY "Borrowers can read their withdrawals" ON withdrawals
  FOR SELECT TO authenticated
  USING (borrower_user_id = auth.uid());

-- Borrowers record their own withdrawal after broadcasting the transfer.
CREATE POLICY "Borrowers can create their withdrawals" ON withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (borrower_user_id = auth.uid());

-- Service role (edge functions) full access.
CREATE POLICY "Service role can manage withdrawals" ON withdrawals
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
