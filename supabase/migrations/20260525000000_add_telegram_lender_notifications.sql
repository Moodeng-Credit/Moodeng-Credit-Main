CREATE EXTENSION IF NOT EXISTS "pg_net";

CREATE TABLE IF NOT EXISTS public.telegram_bot_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.telegram_bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage telegram bot settings" ON public.telegram_bot_settings;
CREATE POLICY "Service role can manage telegram bot settings"
  ON public.telegram_bot_settings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.telegram_bot_settings (key, value, description)
VALUES
  ('lender_notifications_enabled', 'false', 'Set to true after the staging lender Telegram group chat_id is configured.')
ON CONFLICT (key) DO NOTHING;

CREATE SCHEMA IF NOT EXISTS private;

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

  PERFORM net.http_post(
    url := project_url || '/functions/v1/loan-request-telegram-notification',
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

DROP TRIGGER IF EXISTS trigger_notify_loan_request_telegram ON public.loans;
CREATE TRIGGER trigger_notify_loan_request_telegram
  AFTER INSERT ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_loan_request_telegram();
