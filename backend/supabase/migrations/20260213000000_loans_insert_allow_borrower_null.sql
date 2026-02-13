-- Allow loan insert when borrower_user_id = auth.uid() OR borrower_user_id IS NULL (for temporary/testing)
DROP POLICY IF EXISTS "Authenticated users can create loans" ON loans;

CREATE POLICY "Authenticated users can create loans" ON loans
  FOR INSERT TO authenticated
  WITH CHECK (
    borrower_user_id = auth.uid()
    OR borrower_user_id IS NULL
  );
