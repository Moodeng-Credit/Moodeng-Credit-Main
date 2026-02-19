-- Transaction type: discrete events tied to a loan
CREATE TYPE transaction_type AS ENUM ('loan_requested', 'loan_funded', 'repayment');

-- Transactions table: correlates with loans and users
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type transaction_type NOT NULL,
  amount DECIMAL(18, 6) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USDC',
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.transactions IS 'Discrete loan-related events: request, funding, repayment. Links loans and users.';
COMMENT ON COLUMN public.transactions.from_user_id IS 'User who sent / paid (borrower for request/repayment, lender for funding).';
COMMENT ON COLUMN public.transactions.to_user_id IS 'User who received (lender for repayment, borrower for funding). Null for loan_requested.';

CREATE INDEX idx_transactions_loan_id ON public.transactions(loan_id);
CREATE INDEX idx_transactions_from_user_id ON public.transactions(from_user_id);
CREATE INDEX idx_transactions_to_user_id ON public.transactions(to_user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can read transactions where they are from or to
CREATE POLICY "Users can read own transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Only service/backend should insert (e.g. when loan is created, funded, or repaid)
-- Allow authenticated users to insert for loan_requested (borrower = from_user_id)
CREATE POLICY "Borrowers can insert loan_requested"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    type = 'loan_requested'
    AND from_user_id = auth.uid()
    AND to_user_id IS NULL
  );

-- Lenders can insert loan_funded when they are from_user_id
CREATE POLICY "Lenders can insert loan_funded"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    type = 'loan_funded'
    AND from_user_id = auth.uid()
  );

-- Borrowers can insert repayment when they are from_user_id
CREATE POLICY "Borrowers can insert repayment"
  ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (
    type = 'repayment'
    AND from_user_id = auth.uid()
  );
