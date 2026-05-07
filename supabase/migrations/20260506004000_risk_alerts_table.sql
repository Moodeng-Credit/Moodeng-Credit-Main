-- =================================================================
-- risk_alerts: dedup ledger for admin email notifications.
-- Each row = "we sent an email to admin about user X for severity S
-- at time T". Used by risk-score-recompute to avoid spamming.
-- =================================================================

CREATE TABLE IF NOT EXISTS public.risk_alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  severity    text NOT NULL CHECK (severity IN ('critical','high','medium')),
  signal_key  text NOT NULL,           -- e.g. 'self_lending_hard_match', 'sybil_cluster', 'critical_band'
  factors     jsonb NOT NULL DEFAULT '[]'::jsonb,
  message     text,
  email_to    text,                    -- recipient (audit trail)
  email_sent  boolean NOT NULL DEFAULT false,
  email_error text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS risk_alerts_user_signal_idx
  ON public.risk_alerts (user_id, signal_key, created_at DESC);

CREATE INDEX IF NOT EXISTS risk_alerts_created_at_idx
  ON public.risk_alerts (created_at DESC);

-- RLS — service role only.
ALTER TABLE public.risk_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS risk_alerts_service_role ON public.risk_alerts;
CREATE POLICY risk_alerts_service_role ON public.risk_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
