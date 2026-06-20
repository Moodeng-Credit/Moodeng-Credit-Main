-- Stores the raw Didit status string for the ID-check workflow so the
-- frontend can distinguish "In Review" (manual review in progress) from
-- "Declined" and other terminal states without waiting for is_didit to flip.
-- Overwritten on every status.updated webhook event for the ID workflow.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS didit_id_status TEXT;
