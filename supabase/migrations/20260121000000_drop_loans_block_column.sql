-- Drop legacy block column if it exists
ALTER TABLE public.loans DROP COLUMN IF EXISTS block;
