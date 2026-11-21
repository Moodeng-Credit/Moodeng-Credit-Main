-- Database efficiency after the 2026-11-16/17 outage (Free/Nano instance ran out of memory under an
-- admin-tab request storm). Same data, same screens — fewer and cheaper queries.
--
-- 1. admin_directory_bundle / admin_overview_counts: the admin page's full refresh was ~45 HTTP
--    requests (9 count HEADs + the directory split into 8 tables × 100-id chunks). Now 2 RPCs.
-- 2. RLS policies: auth.uid() / auth.jwt() / auth.role() / app_private.is_moodeng_admin() wrapped in
--    (select …) so Postgres evaluates them once per query instead of once per row (Supabase lint 0003).
-- 3. viber_relay_claim: the relay polls every ~20 s and wrote a heartbeat row every time; now at most
--    once a minute.
-- 4. Every-5/10/15-minute cron jobs no longer all start on the same second.

-- ---- 1. Admin page bundles -------------------------------------------------------------------------

create or replace function public.admin_directory_bundle(p_search text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
   v_search text := nullif(trim(coalesce(p_search, '')), '');
   v_ids uuid[];
begin
   -- Same rows the admin RLS policies already let an admin read.
   if not app_private.is_moodeng_admin() then
      raise exception 'forbidden' using errcode = '42501';
   end if;

   select coalesce(array_agg(s.id), '{}')
     into v_ids
     from (
        select u.id
          from public.users u
         where v_search is null
            or u.username ilike '%' || v_search || '%'
            or u.wallet_address ilike '%' || v_search || '%'
            or u.email ilike '%' || v_search || '%'
         order by u.created_at desc
         limit 2000
     ) s;

   return jsonb_build_object(
      'users', coalesce((
         select jsonb_agg(to_jsonb(x) order by x.created_at desc)
           from (
              select id, username, email, wallet_address, wallet_provider, wallet_connector_name, wallet_chain_id, user_role,
                     account_status, is_world_id, is_didit, messenger_verified_at, messenger_psid, whatsapp_verified_at,
                     loan_access_status, video_call_starts_at, video_call_outcome, didit_id_status, didit_submitted_at,
                     cs, mal, nal, created_at, updated_at
                from public.users
               where id = any(v_ids)
           ) x), '[]'::jsonb),
      'loans', coalesce((
         select jsonb_agg(to_jsonb(x))
           from (
              select id, borrower_user_id, lender_user_id, loan_amount, total_repayment_amount, repaid_amount, due_date,
                     loan_status, repayment_status, refunded_at, created_at, funded_at
                from public.loans
               where borrower_user_id = any(v_ids) or lender_user_id = any(v_ids)
           ) x), '[]'::jsonb),
      'restrictions', coalesce((select jsonb_agg(to_jsonb(r)) from public.admin_account_restrictions r where r.user_id = any(v_ids)), '[]'::jsonb),
      'risk_profiles', coalesce((select jsonb_agg(to_jsonb(r)) from public.admin_risk_profiles r where r.user_id = any(v_ids)), '[]'::jsonb),
      'points', coalesce((
         select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'points_total', p.points_total, 'updated_at', p.updated_at, 'last_event_id', p.last_event_id))
           from public.user_points p where p.user_id = any(v_ids)), '[]'::jsonb),
      'point_events', coalesce((
         select jsonb_agg(to_jsonb(x) order by x.created_at desc)
           from (
              select id, user_id, event_type, delta, source_type, source_id, created_at, metadata
                from public.point_events where user_id = any(v_ids)
               order by created_at desc limit 1200
           ) x), '[]'::jsonb),
      'trust_points', coalesce((
         select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'points_total', p.points_total, 'updated_at', p.updated_at, 'last_event_id', p.last_event_id))
           from public.user_trust_points p where p.user_id = any(v_ids)), '[]'::jsonb),
      'trust_point_events', coalesce((
         select jsonb_agg(to_jsonb(x) order by x.created_at desc)
           from (
              select id, user_id, event_type, delta, source_type, source_id, created_at, metadata
                from public.trust_point_events where user_id = any(v_ids)
               order by created_at desc limit 1200
           ) x), '[]'::jsonb),
      -- The directory shows each person's newest sighting, falling back to the newest one with a
      -- country: those two rows per person are all it needs (was every row ever logged).
      'ip_log', coalesce((
         select jsonb_agg(to_jsonb(x) order by x.last_seen_at desc)
           from (
              select distinct on (l.user_id, l.country_iso is not null) l.user_id, l.country_iso, l.city_name, l.last_seen_at
                from public.auth_ip_log l where l.user_id = any(v_ids)
               order by l.user_id, l.country_iso is not null, l.last_seen_at desc
           ) x), '[]'::jsonb)
   );
end;
$$;

revoke all on function public.admin_directory_bundle(text) from public, anon;
grant execute on function public.admin_directory_bundle(text) to authenticated;

create or replace function public.admin_overview_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
   if not app_private.is_moodeng_admin() then
      raise exception 'forbidden' using errcode = '42501';
   end if;

   return jsonb_build_object(
      'all_users', (select count(*) from public.users),
      'open_requests', (select count(*) from public.loans where loan_status = 'Requested'),
      'active_loans', (select count(*) from public.loans where loan_status = 'Lent' and repayment_status in ('Unpaid', 'Partial')),
      'defaulted_loans', (select count(*) from public.loans where loan_status = 'Lent' and repayment_status in ('Unpaid', 'Partial') and due_date < now()),
      'recovery_reviews', (select count(*) from public.default_recovery_cases where status in ('needs_review', 'active')),
      'banned_users', (select count(*) from public.admin_account_restrictions where status = 'banned'),
      'watchlist_users', (select count(*) from public.admin_account_restrictions where status = 'watchlist'),
      'loan_request_reviews', (select count(*) from public.admin_loan_request_reviews where status in ('needs_review', 'reported', 'duplicate')),
      'high_risk_profiles', (select count(*) from public.admin_risk_profiles where risk_level = 'high')
   );
end;
$$;

revoke all on function public.admin_overview_counts() from public, anon;
grant execute on function public.admin_overview_counts() to authenticated;

-- ---- 2. RLS: evaluate auth helpers once per query ----------------------------------------------------
-- Rewrites each public policy's USING / WITH CHECK text, wrapping bare calls in (select …). Already
-- wrapped calls deparse as "( SELECT auth.uid() AS uid)" and are left alone, so this is re-runnable.

do $$
declare
   p record;
   v_using text;
   v_check text;
   v_pattern constant text := '(?<!SELECT )(auth\.(uid|jwt|role)\(\)|app_private\.is_moodeng_admin\(\))';
begin
   for p in
      select schemaname, tablename, policyname, qual, with_check
        from pg_policies
       where schemaname = 'public'
         and (coalesce(qual, '') ~ v_pattern or coalesce(with_check, '') ~ v_pattern)
   loop
      v_using := case when p.qual is null then null else regexp_replace(p.qual, v_pattern, '(select \1)', 'g') end;
      v_check := case when p.with_check is null then null else regexp_replace(p.with_check, v_pattern, '(select \1)', 'g') end;
      if v_using is not null then
         execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, v_using);
      end if;
      if v_check is not null then
         execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, v_check);
      end if;
   end loop;
end;
$$;

-- ---- 3. Viber relay heartbeat: at most once a minute ------------------------------------------------

create or replace function public.viber_relay_claim(p_token text, p_limit integer default 5)
returns table(id bigint, phone text, body text, kind text)
language plpgsql
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
begin
   if not private.viber_relay_token_ok(p_token) then
      raise exception 'forbidden';
   end if;
   -- The relay polls every ~20 s; "last seen" only needs minute precision.
   insert into public.telegram_bot_settings (key, value) values ('viber_relay_last_seen', now()::text)
   on conflict (key) do update set value = excluded.value
    where case
             when telegram_bot_settings.value ~ '^\d{4}-\d{2}-\d{2}'
                then telegram_bot_settings.value::timestamptz < now() - interval '1 minute'
             else true
          end;

   update public.viber_outbox o set status = 'queued'
    where o.status = 'sending' and o.claimed_at < now() - interval '10 minutes';

   return query
   update public.viber_outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
    where o.id in (
       select q.id from public.viber_outbox q
        where q.status = 'queued'
        order by (q.kind = 'code') desc, q.created_at
        limit least(greatest(p_limit, 1), 20)
        for update skip locked
    )
   returning o.id, o.phone, o.body, o.kind;
end;
$function$;

-- ---- 4. Spread the frequent cron jobs across the minute grid --------------------------------------

select cron.alter_job(j.jobid, schedule := s.schedule)
  from cron.job j
  join (values
     ('video-call-reminders-15min', '1-59/5 * * * *'),
     ('messenger-stuck-alerts-5min', '2-59/5 * * * *'),
     ('sms-otp-reconcile-2min', '3-59/5 * * * *'),
     ('viber-watchdog', '4-59/5 * * * *'),
     ('vault-watch-5min', '2-59/5 * * * *'),
     ('auth-send-volume-alarm', '6-59/10 * * * *'),
     ('phone-signup-watch', '8-59/10 * * * *'),
     ('unsent-loan-requests-15min', '11-59/15 * * * *')
  ) as s(jobname, schedule) on s.jobname = j.jobname;
