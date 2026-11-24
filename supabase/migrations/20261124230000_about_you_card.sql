-- "About you" card (sign-up + pre-screening): gender, age and how many kids, as the person tells us.
-- Didit's ID read (kyc_identities.gender / date_of_birth) stays the checked source; these are self-reported
-- and come in before KYC, so Growth can see who signs up (and who drops off) — not used to grade anyone.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS about_gender text CHECK (about_gender IN ('female', 'male')),
  ADD COLUMN IF NOT EXISTS about_age smallint CHECK (about_age BETWEEN 18 AND 99),
  ADD COLUMN IF NOT EXISTS about_kids smallint CHECK (about_kids BETWEEN 0 AND 20),
  ADD COLUMN IF NOT EXISTS about_you_at timestamptz;

-- Save your own answers (signed in). Answering again overwrites.
CREATE OR REPLACE FUNCTION public.save_about_you(p_gender text, p_age integer, p_kids integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in first' USING ERRCODE = '42501';
  END IF;
  IF p_gender NOT IN ('female', 'male') OR p_age NOT BETWEEN 18 AND 99 OR p_kids NOT BETWEEN 0 AND 20 THEN
    RAISE EXCEPTION 'bad answer' USING ERRCODE = '22023';
  END IF;
  UPDATE public.users
     SET about_gender = p_gender, about_age = p_age, about_kids = p_kids, about_you_at = now()
   WHERE id = auth.uid();
  RETURN FOUND;
END;
$$;

-- Have I answered it? (so the card isn't shown twice)
CREATE OR REPLACE FUNCTION public.about_you_done()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT about_you_at IS NOT NULL FROM public.users WHERE id = auth.uid()), false);
$$;

REVOKE ALL ON FUNCTION public.save_about_you(text, integer, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.about_you_done() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_about_you(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.about_you_done() TO authenticated;
