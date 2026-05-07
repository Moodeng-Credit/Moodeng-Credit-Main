ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS redeemed_referral_code_id UUID REFERENCES public.referral_codes(id),
  ADD COLUMN IF NOT EXISTS referral_boost_amount NUMERIC(18, 6);

CREATE INDEX IF NOT EXISTS idx_users_redeemed_referral_code_id
  ON public.users (redeemed_referral_code_id)
  WHERE redeemed_referral_code_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.redeem_referral_code(code_input TEXT)
RETURNS TABLE (
  id UUID,
  code TEXT,
  boost_amount NUMERIC,
  previous_limit NUMERIC,
  new_limit NUMERIC,
  already_redeemed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_code TEXT := UPPER(TRIM(code_input));
  current_user_id UUID := auth.uid();
  referral_row public.referral_codes%ROWTYPE;
  user_row public.users%ROWTYPE;
  previous_limit_value NUMERIC;
  new_limit_value NUMERIC;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF clean_code IS NULL OR clean_code = '' THEN
    RAISE EXCEPTION 'Referral code required' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO user_row
  FROM public.users
  WHERE public.users.id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  previous_limit_value := GREATEST(COALESCE(user_row.cs, 0), 15);

  IF user_row.redeemed_referral_code_id IS NOT NULL THEN
    SELECT *
    INTO referral_row
    FROM public.referral_codes
    WHERE public.referral_codes.id = user_row.redeemed_referral_code_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Redeemed referral code not found' USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
      SELECT
        referral_row.id,
        referral_row.code,
        COALESCE(user_row.referral_boost_amount, referral_row.boost_amount),
        previous_limit_value,
        previous_limit_value,
        TRUE;
    RETURN;
  END IF;

  SELECT *
  INTO referral_row
  FROM public.referral_codes
  WHERE public.referral_codes.code = clean_code
    AND public.referral_codes.is_active = TRUE
    AND (public.referral_codes.expires_at IS NULL OR public.referral_codes.expires_at > NOW())
    AND (public.referral_codes.max_uses IS NULL OR public.referral_codes.current_uses < public.referral_codes.max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referral code incorrect. If you have issues, contact support.' USING ERRCODE = 'P0001';
  END IF;

  new_limit_value := GREATEST(
    previous_limit_value,
    LEAST(previous_limit_value + referral_row.boost_amount, 15 + referral_row.boost_amount)
  );

  UPDATE public.users
  SET
    cs = new_limit_value::INTEGER,
    redeemed_referral_code_id = referral_row.id,
    referral_boost_amount = referral_row.boost_amount,
    updated_at = NOW()
  WHERE public.users.id = current_user_id;

  UPDATE public.referral_codes
  SET
    current_uses = public.referral_codes.current_uses + 1,
    updated_at = NOW()
  WHERE public.referral_codes.id = referral_row.id;

  RETURN QUERY
    SELECT
      referral_row.id,
      referral_row.code,
      referral_row.boost_amount,
      previous_limit_value,
      new_limit_value,
      FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_referral_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(TEXT) TO authenticated;
