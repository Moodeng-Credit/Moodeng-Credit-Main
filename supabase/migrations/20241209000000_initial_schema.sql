-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- World ID Status enum
CREATE TYPE world_id_status AS ENUM ('INACTIVE', 'ACTIVE');

-- Loan Status enum
CREATE TYPE loan_status AS ENUM ('Requested', 'Lent');

-- Repayment Status enum
CREATE TYPE repayment_status AS ENUM ('Unpaid', 'Partial', 'Paid');

-- Users table (linked to Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT UNIQUE,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  google_id TEXT UNIQUE,
  telegram_id BIGINT UNIQUE,
  telegram_username TEXT UNIQUE,
  chat_id BIGINT UNIQUE,
  is_world_id world_id_status DEFAULT 'INACTIVE',
  nullifier_hash TEXT UNIQUE,
  mal INTEGER DEFAULT 3,           -- max active loans
  nal INTEGER DEFAULT 0,           -- number active loans
  cs INTEGER DEFAULT 15,           -- credit score
  reset_token TEXT UNIQUE,
  reset_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loans table
CREATE TABLE loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT UNIQUE NOT NULL,
  borrower_wallet TEXT,
  lender_wallet TEXT,
  borrower_user TEXT REFERENCES users(username),
  lender_user TEXT REFERENCES users(username),
  loan_amount DECIMAL(18, 6) NOT NULL,
  repaid_amount DECIMAL(18, 6) DEFAULT 0,
  total_repayment_amount DECIMAL(18, 6) NOT NULL,
  reason TEXT NOT NULL,
  loan_status loan_status DEFAULT 'Requested',
  repayment_status repayment_status DEFAULT 'Unpaid',
  days INTEGER NOT NULL,
  block TEXT NOT NULL,
  coin TEXT NOT NULL,
  hash TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_loans_borrower_user ON loans(borrower_user);
CREATE INDEX idx_loans_lender_user ON loans(lender_user);
CREATE INDEX idx_loans_status ON loans(loan_status);
CREATE INDEX idx_loans_repayment ON loans(repayment_status);
CREATE INDEX idx_loans_created ON loans(created_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Users
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public profiles are viewable" ON users
  FOR SELECT USING (true);

-- RLS Policies for Loans
CREATE POLICY "Anyone can read loans" ON loans
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create loans" ON loans
  FOR INSERT TO authenticated
  WITH CHECK (borrower_user = (SELECT username FROM users WHERE id = auth.uid()));

CREATE POLICY "Borrowers can update their loans" ON loans
  FOR UPDATE TO authenticated
  USING (borrower_user = (SELECT username FROM users WHERE id = auth.uid()));

CREATE POLICY "Lenders can update loans they fund" ON loans
  FOR UPDATE TO authenticated
  USING (lender_user = (SELECT username FROM users WHERE id = auth.uid())
         OR lender_user IS NULL);

CREATE POLICY "Borrowers can delete their pending loans" ON loans
  FOR DELETE TO authenticated
  USING (borrower_user = (SELECT username FROM users WHERE id = auth.uid())
         AND loan_status = 'Requested');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();