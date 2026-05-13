CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  boost_amount NUMERIC(18, 6) NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER,
  current_uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_codes_code_uppercase CHECK (code = UPPER(TRIM(code))),
  CONSTRAINT referral_codes_boost_amount_positive CHECK (boost_amount > 0),
  CONSTRAINT referral_codes_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0),
  CONSTRAINT referral_codes_current_uses_nonnegative CHECK (current_uses >= 0)
);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can validate active referral codes" ON public.referral_codes;
CREATE POLICY "Anyone can validate active referral codes"
  ON public.referral_codes
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses)
  );

CREATE INDEX IF NOT EXISTS idx_referral_codes_active_code
  ON public.referral_codes (code)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS update_referral_codes_updated_at ON public.referral_codes;
CREATE TRIGGER update_referral_codes_updated_at BEFORE UPDATE ON public.referral_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS referral_code_id UUID REFERENCES public.referral_codes(id),
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referral_boost_amount NUMERIC(18, 6);

CREATE INDEX IF NOT EXISTS idx_loans_referral_code_id
  ON public.loans (referral_code_id)
  WHERE referral_code_id IS NOT NULL;

INSERT INTO public.referral_codes (code, boost_amount)
VALUES
  ('BOOST5', 5),
  ('TEST123', 5)
ON CONFLICT (code) DO UPDATE
SET
  boost_amount = EXCLUDED.boost_amount,
  is_active = true,
  updated_at = NOW();
