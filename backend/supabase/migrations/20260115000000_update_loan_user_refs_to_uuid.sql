-- Backfill and convert loan user references to auth user UUIDs

ALTER TABLE loans
  ADD COLUMN borrower_user_id UUID,
  ADD COLUMN lender_user_id UUID;

UPDATE loans
SET borrower_user_id = users.id
FROM users
WHERE loans.borrower_user = users.username;

UPDATE loans
SET lender_user_id = users.id
FROM users
WHERE loans.lender_user = users.username;

DROP POLICY IF EXISTS "Authenticated users can create loans" ON loans;
DROP POLICY IF EXISTS "Borrowers can update their loans" ON loans;
DROP POLICY IF EXISTS "Lenders can update loans they fund" ON loans;
DROP POLICY IF EXISTS "Borrowers can delete their pending loans" ON loans;

ALTER TABLE loans
  DROP CONSTRAINT IF EXISTS loans_borrower_user_fkey,
  DROP CONSTRAINT IF EXISTS loans_lender_user_fkey;

DROP INDEX IF EXISTS idx_loans_borrower_user;
DROP INDEX IF EXISTS idx_loans_lender_user;

ALTER TABLE loans
  DROP COLUMN borrower_user,
  DROP COLUMN lender_user;

ALTER TABLE loans
  RENAME COLUMN borrower_user_id TO borrower_user;

ALTER TABLE loans
  RENAME COLUMN lender_user_id TO lender_user;

ALTER TABLE loans
  ADD CONSTRAINT loans_borrower_user_fkey
    FOREIGN KEY (borrower_user) REFERENCES users(id),
  ADD CONSTRAINT loans_lender_user_fkey
    FOREIGN KEY (lender_user) REFERENCES users(id);

CREATE INDEX idx_loans_borrower_user ON loans(borrower_user);
CREATE INDEX idx_loans_lender_user ON loans(lender_user);

CREATE POLICY "Authenticated users can create loans" ON loans
  FOR INSERT TO authenticated
  WITH CHECK (borrower_user = auth.uid());

CREATE POLICY "Borrowers can update their loans" ON loans
  FOR UPDATE TO authenticated
  USING (borrower_user = auth.uid());

CREATE POLICY "Lenders can update loans they fund" ON loans
  FOR UPDATE TO authenticated
  USING (lender_user = auth.uid() OR lender_user IS NULL);

CREATE POLICY "Borrowers can delete their pending loans" ON loans
  FOR DELETE TO authenticated
  USING (borrower_user = auth.uid() AND loan_status = 'Requested');
