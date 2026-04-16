-- Allow anonymous (logged-out) users to read loans for the public request board
-- The existing "Anyone can read loans" policy was incorrectly scoped to authenticated only
DROP POLICY IF EXISTS "Anyone can read loans" ON loans;

CREATE POLICY "Anyone can read loans" ON loans
  FOR SELECT TO anon, authenticated USING (true);
