ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credit_progression_paused boolean NOT NULL DEFAULT false;
