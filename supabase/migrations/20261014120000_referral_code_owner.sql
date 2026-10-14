-- Link a promo/referral code to the person behind it (influencer, partner, ambassador).
-- owner_user_id may already exist in prod (added without a FK), so add the FK separately.
ALTER TABLE public.referral_codes
  ADD COLUMN IF NOT EXISTS owner_user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referral_codes_owner_user_id_fkey') THEN
    ALTER TABLE public.referral_codes
      ADD CONSTRAINT referral_codes_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner_user_id
  ON public.referral_codes (owner_user_id)
  WHERE owner_user_id IS NOT NULL;
