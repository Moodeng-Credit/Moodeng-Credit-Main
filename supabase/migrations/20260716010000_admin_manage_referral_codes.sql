-- Admins can see all referral codes (incl. inactive) and manage them.
-- The anon "validate active codes" SELECT policy is unchanged (policies OR).
DROP POLICY IF EXISTS "admins manage referral codes" ON public.referral_codes;
CREATE POLICY "admins manage referral codes"
  ON public.referral_codes
  FOR ALL
  TO authenticated
  USING (app_private.is_moodeng_admin())
  WITH CHECK (app_private.is_moodeng_admin());
