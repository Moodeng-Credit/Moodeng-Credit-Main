-- The desktop QR's phone page (moodeng.app/fb/<code>, MessengerHandoff) shows "✓ Connected" itself
-- once the bot confirms, so the borrower doesn't have to go back to the laptop to find out. The page
-- has no sign-in, so it asks by code.
--
-- Returns true only for a Messenger code that has been verified (or whose borrower is); false for
-- pending, expired AND unknown codes alike, so it can't be used to find out which live codes exist.
-- A verified borrower's code is spent, so knowing one gives nothing.

CREATE OR REPLACE FUNCTION public.messenger_code_verified(p_code TEXT)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
   -- The code itself, or its borrower (an admin's "Mark Facebook verified" or a name match may only
   -- stamp users.messenger_verified_at).
   SELECT EXISTS (
      SELECT 1
        FROM public.contact_verification_codes c
        JOIN public.users u ON u.id = c.user_id
       WHERE p_code IS NOT NULL
         AND c.code = upper(p_code)
         AND c.channel = 'messenger'
         AND (c.verified_at IS NOT NULL OR u.messenger_verified_at IS NOT NULL)
   );
$$;

REVOKE ALL ON FUNCTION public.messenger_code_verified(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.messenger_code_verified(TEXT) TO anon, authenticated;
