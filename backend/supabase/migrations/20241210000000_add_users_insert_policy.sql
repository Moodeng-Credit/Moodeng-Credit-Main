-- Add INSERT policy for users table
-- This allows authenticated users to create their own profile row
CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
