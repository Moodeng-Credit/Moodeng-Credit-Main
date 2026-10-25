-- Onboarding friction digest v2 (admin-ux-metrics action clarity_digest).
--
-- 1. clarity_digest_runs: every run's numbers, so the next digest can say what changed since the last
--    one, and dry runs can reuse the last Clarity export instead of spending one of Clarity's 10 daily calls.
-- 2. onboarding_digest_people: each new borrower's onboarding path since a date — the same steps and
--    times as onboarding_timeline, with no name, email, phone or id. The username is only for the
--    team's "stopped partway" list; the digest never sends it to DeepSeek.

CREATE TABLE IF NOT EXISTS public.clarity_digest_runs (
   id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
   created_at timestamptz NOT NULL DEFAULT now(),
   dry_run boolean NOT NULL DEFAULT false,
   window_days integer NOT NULL,
   signups integer NOT NULL,
   -- { "Messenger connected": 50, ... } — % of sign-ups who reached each step
   step_pct jsonb NOT NULL DEFAULT '{}'::jsonb,
   -- { "Dead clicks|/creditline": 44, ... } — % of a page's visits with that problem
   friction_pct jsonb NOT NULL DEFAULT '{}'::jsonb,
   clarity_raw jsonb,
   text text NOT NULL
);

ALTER TABLE public.clarity_digest_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clarity_digest_runs FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.onboarding_digest_people(p_since timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             -- For the team's "stopped partway" list only; never sent to DeepSeek.
             'username', u.username,
             'method', t.timeline ->> 'method',
             'browser', u.signup_browser,
             'os', u.signup_os,
             'locale', u.preferred_locale,
             'steps', t.timeline -> 'steps'
           )
           ORDER BY u.created_at
         ), '[]'::jsonb)
    FROM public.users u
    CROSS JOIN LATERAL (SELECT public.onboarding_timeline(u.id) AS timeline) t
   WHERE u.created_at >= p_since
     AND NOT coalesce(u.is_test, false)
     AND coalesce(u.user_role, 'borrower') = 'borrower'
     AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = u.id);
$$;

REVOKE ALL ON FUNCTION public.onboarding_digest_people(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_digest_people(timestamptz) TO service_role;

-- 07:00 Bangkok (00:00 UTC) instead of 08:00: DeepSeek's off-peak price, and the digest is waiting at the start of the day.
DO $$
BEGIN
   PERFORM cron.unschedule('clarity-digest');
EXCEPTION
   WHEN OTHERS THEN
      NULL;
END $$;

SELECT cron.schedule(
   'clarity-digest',
   '0 0 */3 * *',
   $$
   SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_PROJECT_URL' LIMIT 1) || '/functions/v1/admin-ux-metrics',
      headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SECRET_KEY' LIMIT 1)
      ),
      body := jsonb_build_object(
         'action', 'clarity_digest',
         'clarityToken', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CLARITY_API_TOKEN' LIMIT 1),
         'clarityProjectId', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CLARITY_PROJECT_ID' LIMIT 1)
      ),
      timeout_milliseconds := 120000
   )
   $$
);
