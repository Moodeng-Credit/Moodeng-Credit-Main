-- Admin ⌘K search finds people by their real name. Facebook sign-ups get a placeholder username
-- (user-xxxxxx) and email, so "Rochelle" matched nothing. The directory bundle now returns display_name
-- and facebook_name, and its server-side search also matches them. Same function otherwise.

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
            or u.display_name ilike '%' || v_search || '%'
            or u.facebook_name ilike '%' || v_search || '%'
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
                     cs, mal, nal, created_at, updated_at, display_name, facebook_name
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
