-- LINE Login support: store the LINE user id (OIDC `sub`) so returning
-- LINE users map back to the same Moodeng profile, mirroring telegram_id.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS line_id TEXT UNIQUE;

COMMENT ON COLUMN public.users.line_id IS 'LINE Login user id (OIDC sub claim) for users who signed in with LINE.';
