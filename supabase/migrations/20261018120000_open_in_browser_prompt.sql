-- "For the best experience, open Moodeng in Chrome / Safari" first screen, shown inside Facebook's,
-- Messenger's and Instagram's own browsers before sign-up, with "Continue here" (George, 2026-10-18).
-- Leaving for the real browser at the very start costs nothing (no account yet); leaving later loses a
-- guest's sign-in. Shown by the app (/sign-in, /sign-up) and the static home page.
--
-- Switch: iab_open_prompt_enabled in telegram_bot_settings (on). Set it to 'false' to stop showing it.

INSERT INTO public.telegram_bot_settings (key, value)
VALUES ('iab_open_prompt_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- Read before anyone is signed in, by the app and by the static home page.
CREATE OR REPLACE FUNCTION public.get_iab_open_prompt_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT value = 'true' FROM public.telegram_bot_settings WHERE key = 'iab_open_prompt_enabled'), false);
$$;

REVOKE ALL ON FUNCTION public.get_iab_open_prompt_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_iab_open_prompt_enabled() TO anon, authenticated;
