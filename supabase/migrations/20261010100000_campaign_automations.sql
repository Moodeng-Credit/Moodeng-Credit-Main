-- Automatic journeys (Admin → Campaigns → Automations), run daily by the campaign-automations edge
-- function. Same delivery as manual campaigns (_shared/campaignDelivery.ts): Messenger when Meta's
-- 24h window is open, otherwise email (unless unsubscribed) + app push.
--
-- First journey — 'comeback': a borrower repaid their last loan and hasn't borrowed again. One message
-- per step (default 3 / 14 / 30 days after the repayment), each step sent at most once per repayment
-- ("cycle" = that loan's id, so a later loan + repayment starts a fresh run). A step is only sent
-- inside its own week (delay … delay + 6 days): a person who repaid long ago never gets an old step
-- the day this launches. Weekly cap: nobody gets an automated message within 7 days of any other
-- campaign or automation message — the step waits (inside its week) instead.
-- Ships switched OFF: read the messages, then switch it on in the admin panel.

CREATE TABLE IF NOT EXISTS public.admin_automations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.admin_automation_steps (
  automation_id TEXT NOT NULL REFERENCES public.admin_automations(id) ON DELETE CASCADE,
  step          INTEGER NOT NULL,
  delay_days    INTEGER NOT NULL CHECK (delay_days BETWEEN 1 AND 365),
  subject       TEXT NOT NULL,
  message       TEXT NOT NULL,
  PRIMARY KEY (automation_id, step)
);

CREATE TABLE IF NOT EXISTS public.admin_automation_sends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id TEXT NOT NULL REFERENCES public.admin_automations(id) ON DELETE CASCADE,
  step          INTEGER NOT NULL,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cycle_key     TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('messenger', 'email', 'push')),
  status        TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  detail        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (automation_id, step, user_id, cycle_key, channel)
);

CREATE INDEX IF NOT EXISTS admin_automation_sends_user_idx ON public.admin_automation_sends (user_id, created_at DESC);

ALTER TABLE public.admin_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_automation_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_automations FROM anon, authenticated;
REVOKE ALL ON public.admin_automation_steps FROM anon, authenticated;
REVOKE ALL ON public.admin_automation_sends FROM anon, authenticated;

INSERT INTO public.admin_automations (id, name, enabled)
VALUES ('comeback', 'Repaid → come back', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.admin_automation_steps (automation_id, step, delay_days, subject, message) VALUES
  ('comeback', 1, 3,
   'Thank you for repaying, {first_name}! 🎉',
   E'Hi {first_name},\n\nThank you for repaying your Moodeng loan — every repayment builds your trust with lenders.\n\nYour next loan is ready whenever you need it. Tip: borrowing your full limit and repaying it moves you up to a higher limit.\n\nRequest it in the app: https://moodeng.app/request-board\n\n— Emma & the Moodeng team'),
  ('comeback', 2, 14,
   'Need a little help before payday, {first_name}?',
   E'Hi {first_name},\n\nJust checking in — if something comes up before payday, your Moodeng limit is ready. It only takes a minute to post a request.\n\nhttps://moodeng.app/request-board\n\nAny questions? Just reply to this message.\n\n— Emma & the Moodeng team'),
  ('comeback', 3, 30,
   'We miss you, {first_name} 💜',
   E'Hi {first_name},\n\nIt''s been a month since your last Moodeng loan. Your good repayment record is still here, and so is your limit.\n\nWhenever you need it: https://moodeng.app/request-board\n\nIf anything stopped you from borrowing again, reply and tell us — we read every message.\n\n— Emma & the Moodeng team')
ON CONFLICT (automation_id, step) DO NOTHING;

-- Who's in the comeback journey right now: active, non-test borrowers with nothing open whose most
-- recent funded loan is repaid. cycle_key = that loan's id; days_since = whole days since repayment.
CREATE OR REPLACE FUNCTION public.automation_comeback_candidates()
RETURNS TABLE (
  user_id               UUID,
  email                 TEXT,
  display_name          TEXT,
  username              TEXT,
  messenger_psid        TEXT,
  email_unsubscribed_at TIMESTAMPTZ,
  cycle_key             TEXT,
  repaid_at             TIMESTAMPTZ,
  days_since            INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH borrowers AS (
    SELECT u.* FROM public.users u
    WHERE u.user_role = 'borrower' AND u.account_status = 'active' AND coalesce(u.is_test, false) = false
  ),
  open_loans AS (
    SELECT DISTINCT l.borrower_user_id AS user_id
    FROM public.loans l
    WHERE coalesce(l.is_test, false) = false
      -- A request expires after 7 days unfunded (REQUEST_EXPIRATION_DAYS) but keeps its status.
      AND ((l.funded_at IS NULL AND l.loan_status = 'Requested' AND l.created_at > now() - interval '7 days')
        OR (l.funded_at IS NOT NULL AND l.repaid_at IS NULL AND l.refunded_at IS NULL AND l.offplatform_settled_at IS NULL))
  ),
  last_funded AS (
    SELECT DISTINCT ON (l.borrower_user_id) l.borrower_user_id AS user_id, l.id, l.repaid_at
    FROM public.loans l
    WHERE coalesce(l.is_test, false) = false AND l.funded_at IS NOT NULL
    ORDER BY l.borrower_user_id, l.funded_at DESC
  )
  SELECT b.id, b.email, b.display_name, b.username, b.messenger_psid, b.email_unsubscribed_at,
         lf.id::text, lf.repaid_at, floor(extract(epoch FROM now() - lf.repaid_at) / 86400)::int
  FROM borrowers b
  JOIN last_funded lf ON lf.user_id = b.id AND lf.repaid_at IS NOT NULL
  WHERE NOT EXISTS (SELECT 1 FROM open_loans o WHERE o.user_id = b.id);
$$;

REVOKE ALL ON FUNCTION public.automation_comeback_candidates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.automation_comeback_candidates() TO service_role;

-- Daily at 10:00 Manila (02:00 UTC). The function only sends when the journey is switched on.
DO $$
BEGIN
  PERFORM cron.unschedule('campaign-automations-daily');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

SELECT cron.schedule(
  'campaign-automations-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/campaign-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
    ),
    body := '{"action":"run"}'::jsonb
  )
  $$
);
