-- 1) email-inbound idempotency: one row per processed inbound Message-ID. The edge function
--    claims the id before creating a ticket / Discord post, so a retried webhook is ignored.
--    Service-role only (RLS on, no policies).
CREATE TABLE IF NOT EXISTS public.email_inbound_processed (
  message_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.email_inbound_processed ENABLE ROW LEVEL SECURITY;

-- 2) Withdrawals are now recorded only by the record-withdrawal edge function, which verifies the
--    transfer on Base and writes with the service role. Clients keep read access to their own rows.
DROP POLICY IF EXISTS "Borrowers can create their withdrawals" ON public.withdrawals;
