-- Human-readable reason extracted from Didit's decision payload when the last
-- ID-verification attempt was Declined. Surfaced on the "Verification didn't
-- pass" screen so users know what to fix before retrying. Cleared on approval.
alter table public.users add column if not exists didit_decline_reason text;
