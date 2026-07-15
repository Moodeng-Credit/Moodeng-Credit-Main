INSERT INTO public.referral_codes (code, boost_amount)
VALUES ('JAMIE', 5)
ON CONFLICT (code) DO UPDATE
SET
  boost_amount = EXCLUDED.boost_amount,
  is_active = true,
  updated_at = NOW();
