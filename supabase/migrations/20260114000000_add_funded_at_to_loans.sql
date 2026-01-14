-- Add funded_at column to loans table
-- This tracks the exact timestamp when a loan transitions to 'Lent' status
ALTER TABLE loans ADD COLUMN funded_at TIMESTAMPTZ;

-- Backfill existing funded loans with their updated_at timestamp
UPDATE loans SET funded_at = updated_at WHERE loan_status = 'Lent';

-- Create index for faster queries
CREATE INDEX idx_loans_funded_at ON loans(funded_at);
