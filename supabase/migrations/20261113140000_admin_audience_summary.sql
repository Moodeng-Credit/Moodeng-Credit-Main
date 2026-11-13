-- Admin → Growth → Audience: who our users are, in groups. Where they live (from the ID check, else the
-- country we put them in), age group and gender (ID check), and job / income (application), each with
-- how many borrowed, repaid and are late, and how many joined in the last 30 days.
-- Used to pick affiliate profiles and to spot areas with sign-ups but few borrowers (untapped markets).

create or replace function public.admin_audience_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
   with people as (
      select
         u.id,
         u.created_at,
         -- Country: ID document, else the market we put them in, else their phone's country code.
         coalesce(
            upper(nullif(k.issuing_state, '')),
            case lower(u.market) when 'ph' then 'PHL' when 'id' then 'IDN' when 'th' then 'THA' when 'my' then 'MYS'
               when 'es' then 'ESP' when 'vn' then 'VNM' else upper(nullif(u.market, '')) end,
            case
               when ph.digits like '63%' then 'PHL' when ph.digits like '62%' then 'IDN' when ph.digits like '66%' then 'THA'
               when ph.digits like '60%' then 'MYS' when ph.digits like '84%' then 'VNM' when ph.digits like '34%' then 'ESP'
            end,
            case upper(ip.country_iso) when 'PH' then 'PHL' when 'ID' then 'IDN' when 'TH' then 'THA' when 'MY' then 'MYS'
               when 'VN' then 'VNM' when 'ES' then 'ESP' when 'US' then 'USA' when 'SG' then 'SGP' else upper(ip.country_iso) end,
            'Unknown'
         ) as country,
         -- Where they usually sign in from (IP lookup; approximate, but most users have it).
         initcap(nullif(trim(ip.city_name), '')) as ip_city,
         initcap(nullif(trim(k.region), '')) as region,
         initcap(nullif(trim(k.province), '')) as province,
         initcap(nullif(trim(k.city), '')) as city,
         k.gender,
         case when k.date_of_birth is not null then date_part('year', age(current_date, k.date_of_birth))::int end as age,
         u.income_type,
         u.monthly_income,
         (k.user_id is not null) as id_checked
      from public.users u
      left join auth.users au on au.id = u.id
      cross join lateral (
         select regexp_replace(coalesce(nullif(u.whatsapp_number, ''), au.phone, ''), '\D', '', 'g') as digits
      ) ph
      left join lateral (
         select
            ki.user_id,
            (array_agg(ki.issuing_state order by ki.fetched_at desc nulls last) filter (where ki.issuing_state is not null))[1] as issuing_state,
            (array_agg(ki.region order by ki.fetched_at desc nulls last) filter (where ki.region is not null))[1] as region,
            (array_agg(ki.province order by ki.fetched_at desc nulls last) filter (where ki.province is not null))[1] as province,
            (array_agg(ki.city order by ki.fetched_at desc nulls last) filter (where ki.city is not null))[1] as city,
            (array_agg(ki.gender order by ki.fetched_at desc nulls last) filter (where ki.gender is not null))[1] as gender,
            (array_agg(ki.date_of_birth order by ki.fetched_at desc nulls last) filter (where ki.date_of_birth is not null))[1] as date_of_birth
         from public.kyc_identities ki
         where ki.user_id = u.id
         group by ki.user_id
      ) k on true
      left join lateral (
         select a.country_iso, a.city_name
         from public.auth_ip_log a
         where a.user_id = u.id and not coalesce(a.is_hosting, false) and a.country_iso is not null
         group by a.country_iso, a.city_name
         order by count(*) desc, max(a.last_seen_at) desc
         limit 1
      ) ip on true
      where not coalesce(u.is_test, false)
        and coalesce(u.user_role, 'borrower') <> 'lender'
   ),
   loan_stats as (
      select
         l.borrower_user_id as id,
         true as borrowed,
         bool_or(l.repayment_status = 'Paid') as repaid,
         bool_or(
            (l.repayment_status = 'Paid' and l.repaid_at > l.due_date)
            or (l.repayment_status <> 'Paid' and l.due_date < now() and l.offplatform_settled_at is null)
         ) as late
      from public.loans l
      where l.loan_status = 'Lent' and not coalesce(l.is_test, false) and l.refunded_at is null
      group by l.borrower_user_id
   ),
   p as (
      select people.*,
         coalesce(ls.borrowed, false) as borrowed,
         coalesce(ls.repaid, false) as repaid,
         coalesce(ls.late, false) as late,
         people.created_at > now() - interval '30 days' as recent,
         case
            when people.age is null then 'Unknown'
            when people.age < 20 then 'Under 20'
            when people.age < 25 then '20–24'
            when people.age < 30 then '25–29'
            when people.age < 40 then '30–39'
            else '40+'
         end as age_group
      from people
      left join loan_stats ls on ls.id = people.id
   ),
   -- One row per group with the same counts everywhere.
   g as (
      select 'country' as dim, country as key, null::text as parent, p.* from p
      union all select 'region', coalesce(region, 'Unknown'), case when region is not null then country end, p.* from p
      union all select 'province', coalesce(province, city, 'Unknown'), case when coalesce(province, city) is not null then coalesce(region, country) end, p.* from p
      union all select 'ipCity', coalesce(ip_city, 'Unknown'), case when ip_city is not null then country end, p.* from p
      union all select 'age', age_group, null, p.* from p
      union all select 'gender', case gender when 'M' then 'Male' when 'F' then 'Female' else 'Unknown' end, null, p.* from p
      union all select 'ageGender', age_group || ' · ' || case gender when 'M' then 'M' when 'F' then 'F' else '?' end, null, p.* from p where gender is not null and age is not null
      union all select 'work', coalesce(income_type, 'Unknown'), null, p.* from p
      union all select 'income', coalesce(monthly_income, 'Unknown'), null, p.* from p
   ),
   agg as (
      select dim, key, max(parent) as parent,
         count(*) as users,
         count(*) filter (where borrowed) as borrowers,
         count(*) filter (where repaid) as repaid,
         count(*) filter (where late) as late,
         count(*) filter (where recent) as new30d,
         count(*) filter (where id_checked) as id_checked
      from g
      group by dim, key
   )
   select case when not app_private.is_moodeng_admin() then null else jsonb_build_object(
      'generatedAt', now(),
      'totals', (
         select jsonb_build_object(
            'users', count(*),
            'idChecked', count(*) filter (where id_checked),
            'withPlace', count(*) filter (where region is not null or province is not null or city is not null),
            'withAge', count(*) filter (where age is not null),
            'withIpCity', count(*) filter (where ip_city is not null),
            'borrowers', count(*) filter (where borrowed),
            'repaid', count(*) filter (where repaid),
            'late', count(*) filter (where late),
            'new30d', count(*) filter (where recent)
         ) from p
      ),
      'groups', (
         select jsonb_object_agg(dim, rows) from (
            select dim, jsonb_agg(jsonb_build_object(
               'key', key, 'parent', parent, 'users', users, 'borrowers', borrowers, 'repaid', repaid,
               'late', late, 'new30d', new30d, 'idChecked', id_checked
            ) order by users desc, key) as rows
            from agg
            group by dim
         ) d
      )
   ) end;
$$;

revoke all on function public.admin_audience_summary() from public, anon;
grant execute on function public.admin_audience_summary() to authenticated;
