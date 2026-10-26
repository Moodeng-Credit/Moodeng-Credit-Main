-- Where new borrowers come from (src/lib/attribution.ts): links we share carry ?src=… (e.g.
-- moodeng.app/?src=fb-bonds-oct8, a poster's QR moodeng.app/?src=poster-qc-mall). The browser keeps the
-- first (tagged) visit and, once the person has an account, saves it here through record_signup_source.
-- Only brand-new accounts (created in the last 2 days) are tagged, and only once, so an existing
-- borrower clicking a post later never gets counted as a new sign-up from it. Untagged visits keep the
-- site they came from (facebook.com, tiktok.com…) in signup_referrer. The weekly social recap groups
-- new sign-ups by these.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signup_source text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signup_campaign text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signup_referrer text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signup_landing text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS signup_touched_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_signup_source(
   p_source text,
   p_campaign text,
   p_referrer text,
   p_landing text,
   p_touched_at timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
   UPDATE public.users
      SET signup_source = left(nullif(trim(p_source), ''), 80),
          signup_campaign = left(nullif(trim(p_campaign), ''), 80),
          signup_referrer = left(nullif(trim(p_referrer), ''), 120),
          signup_landing = left(nullif(trim(p_landing), ''), 120),
          signup_touched_at = least(coalesce(p_touched_at, now()), now())
    WHERE id = auth.uid()
      AND signup_touched_at IS NULL
      AND created_at > now() - interval '2 days';
$$;

REVOKE ALL ON FUNCTION public.record_signup_source(text, text, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_signup_source(text, text, text, text, timestamptz) TO authenticated;
