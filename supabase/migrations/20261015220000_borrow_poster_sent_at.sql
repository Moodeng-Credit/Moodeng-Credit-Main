-- sendpulse-events: the "6 things you need to know before borrow" poster goes to a borrower once,
-- on the first message they send the Page after their MDNG code connected Facebook.
-- Set when it's sent (and cleared again if the send fails, so the next message retries).
alter table public.users add column if not exists borrow_poster_sent_at timestamptz;
