-- Admin → Campaigns: re-engage borrowers with one message, delivered on the best channel each person
-- can actually receive. Messenger when Meta's 24h window is open (they messaged the Page recently);
-- otherwise email (unless they unsubscribed) + an app push. See supabase/functions/admin-campaigns.
--
-- Audiences are computed here, from live data, so a list is never stale:
--   past_idle         repaid borrowers with nothing open, whose last funded loan is older than N days
--   fb_not_borrowing  borrowers with a confirmed Messenger line and nothing open right now
-- Both: active accounts only (no blocked / banned), no test accounts.
-- "Open" = a request waiting for a lender (under 7 days old — older ones have expired), or a funded loan not yet closed (repaid / refunded /
-- settled off-platform) — the same rule the admin borrower-contacts view uses.

-- 1) Email unsubscribe (marketing only — loan and account emails still go out) ---------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_unsubscribed_at TIMESTAMPTZ;

-- 2) Campaigns and what each person got ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_campaigns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  audience       TEXT NOT NULL,
  audience_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  subject        TEXT NOT NULL,
  message        TEXT NOT NULL,
  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_campaign_sends (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES public.admin_campaigns(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL CHECK (channel IN ('messenger', 'email', 'push')),
  status       TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  detail       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per person per channel per campaign: a retried send never double-sends.
  UNIQUE (campaign_id, user_id, channel)
);

CREATE INDEX IF NOT EXISTS admin_campaign_sends_user_idx ON public.admin_campaign_sends (user_id, created_at DESC);

-- Service role only — the admin panel reads and writes through the admin-campaigns edge function.
ALTER TABLE public.admin_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_campaign_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_campaigns FROM anon, authenticated;
REVOKE ALL ON public.admin_campaign_sends FROM anon, authenticated;

-- 3) Audiences ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_campaign_audience(p_audience TEXT, p_idle_days INTEGER DEFAULT 30)
RETURNS TABLE (
  user_id                UUID,
  email                  TEXT,
  display_name           TEXT,
  username               TEXT,
  messenger_psid         TEXT,
  messenger_verified_at  TIMESTAMPTZ,
  email_unsubscribed_at  TIMESTAMPTZ,
  funded_loans           INTEGER,
  last_funded_at         TIMESTAMPTZ,
  last_repaid_at         TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH borrowers AS (
    SELECT u.*
    FROM public.users u
    WHERE u.user_role = 'borrower'
      AND u.account_status = 'active'
      AND coalesce(u.is_test, false) = false
  ),
  stats AS (
    SELECT b.id,
           count(l.id) FILTER (WHERE l.funded_at IS NOT NULL)::int AS funded_loans,
           max(l.funded_at) AS last_funded_at,
           max(l.repaid_at) AS last_repaid_at,
           bool_or(
             -- A request expires after 7 days unfunded (REQUEST_EXPIRATION_DAYS) but keeps its status.
             (l.funded_at IS NULL AND l.loan_status = 'Requested' AND l.created_at > now() - interval '7 days')
             OR (l.funded_at IS NOT NULL AND l.repaid_at IS NULL AND l.refunded_at IS NULL AND l.offplatform_settled_at IS NULL)
           ) AS has_open
    FROM borrowers b
    LEFT JOIN public.loans l ON l.borrower_user_id = b.id AND coalesce(l.is_test, false) = false
    GROUP BY b.id
  )
  SELECT b.id, b.email, b.display_name, b.username, b.messenger_psid, b.messenger_verified_at, b.email_unsubscribed_at,
         s.funded_loans, s.last_funded_at, s.last_repaid_at
  FROM borrowers b
  JOIN stats s ON s.id = b.id
  WHERE coalesce(s.has_open, false) = false
    AND CASE p_audience
          WHEN 'past_idle' THEN s.funded_loans > 0
                              AND s.last_funded_at < now() - make_interval(days => greatest(coalesce(p_idle_days, 30), 0))
          WHEN 'fb_not_borrowing' THEN b.messenger_verified_at IS NOT NULL
          ELSE false
        END
  ORDER BY s.last_funded_at DESC NULLS LAST, b.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_campaign_audience(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_campaign_audience(TEXT, INTEGER) TO service_role;
