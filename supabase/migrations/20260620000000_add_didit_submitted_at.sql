-- Tracks when a user submitted their Didit ID documents but hasn't been confirmed yet.
-- Allows the frontend to distinguish "never started" from "submitted, awaiting Didit review".
-- Cleared implicitly once is_didit becomes ACTIVE (the webhook sets that; this column is
-- only meaningful while is_didit is still INACTIVE/null).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS didit_submitted_at TIMESTAMPTZ;
