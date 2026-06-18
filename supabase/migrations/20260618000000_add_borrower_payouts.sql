CREATE TABLE user_payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange TEXT NOT NULL CHECK (exchange IN ('binance', 'coins_ph')),
  token TEXT NOT NULL DEFAULT 'USDC' CHECK (token = 'USDC'),
  network TEXT NOT NULL DEFAULT 'base' CHECK (network = 'base'),
  address TEXT NOT NULL CHECK (address ~* '^0x[0-9a-f]{40}$'),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX user_payout_methods_one_active_idx
  ON user_payout_methods(user_id)
  WHERE is_active;

CREATE INDEX user_payout_methods_user_id_idx ON user_payout_methods(user_id);

ALTER TABLE user_payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Borrowers can read own payout methods" ON user_payout_methods
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Borrowers can create own payout methods" ON user_payout_methods
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Borrowers can update own payout methods" ON user_payout_methods
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_payout_methods_updated_at BEFORE UPDATE ON user_payout_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE ON user_payout_methods TO authenticated;
