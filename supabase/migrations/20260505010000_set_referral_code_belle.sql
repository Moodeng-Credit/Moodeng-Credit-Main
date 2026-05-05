UPDATE public.referral_codes
SET
  is_active = false,
  updated_at = NOW()
WHERE code <> 'BELLE';

INSERT INTO public.referral_codes (code, boost_amount)
VALUES ('BELLE', 5)
ON CONFLICT (code) DO UPDATE
SET
  boost_amount = EXCLUDED.boost_amount,
  is_active = true,
  updated_at = NOW();
