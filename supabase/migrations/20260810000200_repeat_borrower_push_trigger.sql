-- Fire the repeat-borrower lender push from the existing new-request trigger.
--
-- private.notify_loan_request_telegram() already fans a new 'Requested' loan out
-- to the lender-group broadcast and the private team suggestion feed. This adds a
-- third call: a direct push to the specific lenders this borrower has already
-- repaid. Each target function checks its own enable flag, so adding the call is
-- safe even before the flag is flipped.

INSERT INTO public.telegram_bot_settings (key, value, description)
VALUES
  ('repeat_borrower_push_enabled', 'true',
   'Set to false to stop pushing new loan requests to lenders the borrower has already repaid in full.')
ON CONFLICT (key) DO NOTHING;

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
    RAISE WARNING 'Loan request notifications skipped: Supabase project URL or secret key missing from vault.';
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

  -- Direct push to lenders this borrower has already repaid
  -- (gated by repeat_borrower_push_enabled).
  PERFORM net.http_post(
    url := project_url || '/functions/v1/loan-request-repeat-lender-push',
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
