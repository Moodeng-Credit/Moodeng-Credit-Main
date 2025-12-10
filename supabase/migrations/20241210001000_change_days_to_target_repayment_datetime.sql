-- Migration: Change days to target_repayment_datetime
-- Description: Replace the days INTEGER field with target_repayment_datetime TIMESTAMPTZ
-- This allows storing the exact target repayment date/time instead of a relative duration

-- Add the new column as nullable first
ALTER TABLE public.loans
ADD COLUMN target_repayment_datetime TIMESTAMPTZ;

-- Migrate existing data: calculate target_repayment_datetime from created_at + days
UPDATE public.loans
SET target_repayment_datetime = created_at + (days || ' days')::INTERVAL;

-- Make the new column NOT NULL after data migration
ALTER TABLE public.loans
ALTER COLUMN target_repayment_datetime SET NOT NULL;

-- Drop the old days column
ALTER TABLE public.loans
DROP COLUMN days;

-- Add comment to document the field
COMMENT ON COLUMN public.loans.target_repayment_datetime IS 'Target repayment date and time in UTC (set to midnight UTC+00 from user input)';
