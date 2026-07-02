-- Store the latest Didit KYC session so an unfinished verification can be resumed:
-- create-didit-session writes these on every combined/id session it creates, and the
-- /verify page offers "Continue verification" (reopening didit_session_url) when the
-- session was started but never completed ("Not Started" / "In Progress").
ALTER TABLE users ADD COLUMN IF NOT EXISTS didit_session_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS didit_session_url TEXT;
