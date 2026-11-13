-- Borrower profile (Admin → Growth → Borrower profile): who our borrowers are, to decide who to target.
--
-- kyc_identities already keeps what Didit read off each ID (date of birth, address + map point). It now
-- also keeps gender, marital status and the region / province / city Didit's address lookup returns.
-- kyc-cross-check fills them; run it once with {"refetch": true, "dry": true} to backfill old sessions.

ALTER TABLE public.kyc_identities
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS city text;

-- One row per real (non-test) account that has anything to show: an ID read by Didit, an income answer,
-- or a login location. No names, ID numbers or street addresses — map points are rounded to ~10 km.
CREATE OR REPLACE FUNCTION public.admin_borrower_profile()
RETURNS TABLE (
  user_id uuid,
  signed_up_at timestamptz,
  kyc_status text,
  age integer,
  gender text,
  marital_status text,
  id_country text,
  region text,
  province text,
  city text,
  home_lat double precision,
  home_lng double precision,
  ip_country text,
  ip_city text,
  ip_lat double precision,
  ip_lng double precision,
  monthly_income text,
  income_type text,
  signup_source text,
  approved boolean,
  loans integer,
  repaid integer,
  late integer,
  open_overdue integer,
  borrowed_usd numeric
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
  WITH kyc AS (
    -- The best session per account: one with ID data first, approved first, newest first.
    SELECT DISTINCT ON (k.user_id) k.*
      FROM public.kyc_identities k
     WHERE k.user_id IS NOT NULL
     ORDER BY k.user_id,
              (k.date_of_birth IS NOT NULL OR k.gender IS NOT NULL) DESC,
              (k.session_status = 'Approved') DESC,
              k.session_created_at DESC NULLS LAST
  ),
  ip AS (
    -- Where they log in from most often (datacenters / VPNs left out).
    SELECT DISTINCT ON (a.user_id) a.user_id, a.country_iso, a.city_name, a.latitude, a.longitude
      FROM (
        SELECT l.user_id, l.country_iso, l.city_name,
               round(l.latitude::numeric, 1)::double precision AS latitude,
               round(l.longitude::numeric, 1)::double precision AS longitude,
               count(*) AS days
          FROM public.auth_ip_log l
         WHERE l.latitude IS NOT NULL AND coalesce(l.is_hosting, false) = false
         GROUP BY 1, 2, 3, 4, 5
      ) a
     ORDER BY a.user_id, a.days DESC
  ),
  lo AS (
    SELECT l.borrower_user_id AS uid,
           count(*)::int AS loans,
           count(*) FILTER (WHERE l.repaid_at IS NOT NULL)::int AS repaid,
           -- Late = paid after the end of the due day, in the borrower's own time zone.
           count(*) FILTER (
             WHERE l.repaid_at IS NOT NULL
               AND (l.repaid_at AT TIME ZONE coalesce(l.due_timezone, 'Asia/Manila'))::date
                 > (l.due_date AT TIME ZONE coalesce(l.due_timezone, 'Asia/Manila'))::date
           )::int AS late,
           count(*) FILTER (
             WHERE l.repaid_at IS NULL AND l.refunded_at IS NULL AND l.offplatform_settled_at IS NULL
               AND (now() AT TIME ZONE coalesce(l.due_timezone, 'Asia/Manila'))::date
                 > (l.due_date AT TIME ZONE coalesce(l.due_timezone, 'Asia/Manila'))::date
           )::int AS open_overdue,
           coalesce(sum(l.loan_amount::numeric), 0) AS borrowed_usd
      FROM public.loans l
     WHERE l.funded_at IS NOT NULL AND coalesce(l.is_test, false) = false AND l.borrower_user_id IS NOT NULL
     GROUP BY 1
  )
  SELECT u.id,
         u.created_at,
         kyc.session_status,
         CASE WHEN kyc.date_of_birth IS NOT NULL
              THEN extract(year FROM age(current_date, kyc.date_of_birth))::int END,
         CASE upper(left(kyc.gender, 1)) WHEN 'M' THEN 'Male' WHEN 'F' THEN 'Female' END,
         initcap(nullif(kyc.marital_status, '')),
         kyc.issuing_state,
         nullif(kyc.region, ''),
         nullif(kyc.province, ''),
         nullif(kyc.city, ''),
         round(kyc.latitude::numeric, 1)::double precision,
         round(kyc.longitude::numeric, 1)::double precision,
         ip.country_iso,
         ip.city_name,
         ip.latitude,
         ip.longitude,
         nullif(u.monthly_income, ''),
         nullif(u.income_type, ''),
         u.signup_source,
         u.loan_access_status::text = 'approved',
         coalesce(lo.loans, 0),
         coalesce(lo.repaid, 0),
         coalesce(lo.late, 0),
         coalesce(lo.open_overdue, 0),
         coalesce(lo.borrowed_usd, 0)
    FROM public.users u
    LEFT JOIN kyc ON kyc.user_id = u.id
    LEFT JOIN ip ON ip.user_id = u.id
    LEFT JOIN lo ON lo.uid = u.id
   WHERE coalesce(u.is_test, false) = false
     AND (kyc.user_id IS NOT NULL OR ip.user_id IS NOT NULL OR nullif(u.monthly_income, '') IS NOT NULL OR lo.uid IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_borrower_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_borrower_profile() TO authenticated;
