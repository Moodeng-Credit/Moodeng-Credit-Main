-- Defense-in-depth: the "Users can update own data" policy had USING but no WITH CHECK, so a self-
-- update wasn't re-validated on the NEW row (e.g. could set id to a different uuid). The sensitive
-- columns are already locked by trg_enforce_user_privileged_columns; this closes the residual gap on
-- the remaining self-writable columns. Verified on live: a normal self-update (id unchanged) still passes.
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
