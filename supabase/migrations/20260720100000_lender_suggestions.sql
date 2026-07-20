-- Lender suggestion feed for the private George+Emma Telegram channel.
--
-- When a new loan request comes in we post a ranked list of real, joined lenders
-- (scored against the request) plus a manual roster of off-platform prospects for
-- the team to reach out to by hand. Nobody is assigned — these are suggestions.
--
-- This migration adds:
--   1. lender_prospects — the manual roster, managed via Telegram bot commands.
--   2. lender_suggestions_enabled — settings flag gating the feed.
--   3. A second net.http_post in the existing new-request trigger.

CREATE TABLE IF NOT EXISTS public.lender_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  handle TEXT,
  note TEXT,
  added_by TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lender_prospects ENABLE ROW LEVEL SECURITY;

-- Prospect handles are contact PII; only the service role (edge functions +
-- the bot webhook) may read or write them.
DROP POLICY IF EXISTS "Service role manages lender prospects" ON public.lender_prospects;
CREATE POLICY "Service role manages lender prospects"
  ON public.lender_prospects
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.telegram_bot_settings (key, value, description)
VALUES
  ('lender_suggestions_enabled', 'false',
   'Set to true to post ranked lender + prospect suggestions to the team channel when a new loan request arrives.')
ON CONFLICT (key) DO NOTHING;

-- Extend the existing new-request trigger to also fire the suggestion feed.
-- The trigger itself (trigger_notify_loan_request_telegram) already exists; we
-- only replace the function body so it calls both edge functions. Each function
-- independently checks its own enable flag, so this is safe to ship dark.
CREATE OR REPLACE FUNCTION private.notify_loan_request_telegram()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  project_url TEXT;
  service_key TEXT;
BEGIN
  IF NEW.loan_status <> 'Requested' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
  INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_PROJECT_URL'
  LIMIT 1;

  SELECT decrypted_secret
  INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SECRET_KEY'
  LIMIT 1;

  IF project_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Telegram lender notification skipped: Supabase project URL or secret key missing from vault.';
    RETURN NEW;
  END IF;

  -- Broad lender-group broadcast (gated by lender_notifications_enabled).
  PERFORM net.http_post(
    url := project_url || '/functions/v1/loan-request-telegram-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('loanId', NEW.id)
  );

  -- Private team suggestion feed (gated by lender_suggestions_enabled).
  PERFORM net.http_post(
    url := project_url || '/functions/v1/loan-request-lender-suggestions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('loanId', NEW.id)
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.notify_loan_request_telegram() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.notify_loan_request_telegram() FROM anon;
REVOKE ALL ON FUNCTION private.notify_loan_request_telegram() FROM authenticated;
