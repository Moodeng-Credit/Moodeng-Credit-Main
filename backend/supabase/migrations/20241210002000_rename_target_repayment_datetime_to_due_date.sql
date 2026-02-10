-- Migration: Rename target_repayment_datetime to due_date
-- Description: Rename the column from target_repayment_datetime to due_date for better naming convention

-- Rename the column
ALTER TABLE public.loans
RENAME COLUMN target_repayment_datetime TO due_date;

-- Update the comment
COMMENT ON COLUMN public.loans.due_date IS 'Due date for loan repayment in UTC (set to midnight UTC+00 from user input)';
