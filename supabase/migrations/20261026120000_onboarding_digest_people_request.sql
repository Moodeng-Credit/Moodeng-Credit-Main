-- onboarding_digest_people: add each borrower's latest ask-to-borrow / call request, so the digest knows
-- how it ended (approved, cancelled by them or by the team, no-show, still open) instead of treating
-- "asked" as done.
CREATE OR REPLACE FUNCTION public.onboarding_digest_people(p_since timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             -- For the team's lists only; never sent to DeepSeek.
             'username', u.username,
             'method', t.timeline ->> 'method',
             'browser', u.signup_browser,
             'os', u.signup_os,
             'locale', u.preferred_locale,
             'steps', t.timeline -> 'steps',
             'request', (
               SELECT jsonb_build_object('kind', r.kind, 'status', r.status, 'decided_by', r.decided_by, 'decided_at', r.decided_at, 'created_at', r.created_at)
                 FROM public.loan_access_requests r
                WHERE r.user_id = u.id
                ORDER BY r.created_at DESC
                LIMIT 1
             )
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
