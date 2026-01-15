-- Rename loan user reference columns to explicit *_id names

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
  RENAME COLUMN borrower_user TO borrower_user_id;

ALTER TABLE loans
  RENAME COLUMN lender_user TO lender_user_id;

ALTER TABLE loans
  ADD CONSTRAINT loans_borrower_user_id_fkey
    FOREIGN KEY (borrower_user_id) REFERENCES users(id),
  ADD CONSTRAINT loans_lender_user_id_fkey
    FOREIGN KEY (lender_user_id) REFERENCES users(id);

CREATE INDEX idx_loans_borrower_user_id ON loans(borrower_user_id);
CREATE INDEX idx_loans_lender_user_id ON loans(lender_user_id);

CREATE POLICY "Authenticated users can create loans" ON loans
  FOR INSERT TO authenticated
  WITH CHECK (borrower_user_id = auth.uid());

CREATE POLICY "Borrowers can update their loans" ON loans
  FOR UPDATE TO authenticated
  USING (borrower_user_id = auth.uid());

CREATE POLICY "Lenders can update loans they fund" ON loans
  FOR UPDATE TO authenticated
  USING (lender_user_id = auth.uid() OR lender_user_id IS NULL);

CREATE POLICY "Borrowers can delete their pending loans" ON loans
  FOR DELETE TO authenticated
  USING (borrower_user_id = auth.uid() AND loan_status = 'Requested');
