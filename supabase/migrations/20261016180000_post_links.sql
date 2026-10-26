-- Post links: one tracked link per Facebook post (or per person we pay to post), made in
-- Admin → Growth → Post links. The link is moodeng.app/?src=<src>; the app already saves ?src on the
-- account it creates (users.signup_source), and now also counts clicks here (once per browser).
-- admin_post_links() shows, per link: clicks, sign-ups, Facebook connected, approved, ID verified,
-- borrowed.

CREATE TABLE IF NOT EXISTS public.post_links (
  src        text PRIMARY KEY CHECK (src ~ '^[a-z0-9._-]{3,80}$'),
  poster     text NOT NULL,
  place      text,
  note       text,
  clicks     integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.post_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_links FROM anon, authenticated;

DROP POLICY IF EXISTS "admins manage post links" ON public.post_links;
CREATE POLICY "admins manage post links" ON public.post_links
  FOR ALL TO authenticated
  USING (app_private.is_moodeng_admin())
  WITH CHECK (app_private.is_moodeng_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_links TO authenticated;

-- Called by the app when someone lands with ?src=… (once per browser per link). Only counts links
-- that exist, so random ?src values can't fill the table.
CREATE OR REPLACE FUNCTION public.record_post_link_click(p_src text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.post_links SET clicks = clicks + 1 WHERE src = lower(trim(p_src));
$$;

REVOKE ALL ON FUNCTION public.record_post_link_click(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_post_link_click(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_post_links()
RETURNS TABLE (
  src text,
  poster text,
  place text,
  note text,
  created_at timestamptz,
  clicks integer,
  signups bigint,
  facebook_connected bigint,
  approved bigint,
  id_verified bigint,
  borrowed bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT app_private.is_moodeng_admin() THEN
    RAISE EXCEPTION 'admins only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT l.src, l.poster, l.place, l.note, l.created_at, l.clicks,
         count(u.id),
         count(u.id) FILTER (WHERE u.messenger_verified_at IS NOT NULL),
         count(u.id) FILTER (WHERE u.loan_access_status = 'approved'),
         count(u.id) FILTER (WHERE u.is_didit = 'ACTIVE' OR u.is_world_id = 'ACTIVE' OR (to_jsonb(u) ->> 'is_world_id_passport') = 'ACTIVE'),
         count(u.id) FILTER (WHERE EXISTS (SELECT 1 FROM public.loans lo WHERE lo.borrower_user_id = u.id AND lo.funded_at IS NOT NULL))
    FROM public.post_links l
    LEFT JOIN public.users u ON u.signup_source = l.src
   GROUP BY l.src
   ORDER BY l.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_post_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_post_links() TO authenticated;
