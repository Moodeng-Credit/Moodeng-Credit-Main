ALTER TABLE loans
  ADD COLUMN interest_returned_at TIMESTAMPTZ,
  ADD COLUMN interest_return_hash TEXT,
  ADD COLUMN repaid_at TIMESTAMPTZ;
