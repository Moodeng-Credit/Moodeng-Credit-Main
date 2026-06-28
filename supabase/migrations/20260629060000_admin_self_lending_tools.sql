-- Admin tooling for the "Self-lending?" panel:
--   1. Triage fraud_signal_alerts (set review_status from the UI).
--   2. Aggregated login geo points for the hotspot map.
-- Both admin-gated, SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- 1. Mark a fraud alert reviewed (open | ignored | confirmed)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_fraud_alert_status(
  p_alert_id uuid,
  p_status   text,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('open', 'ignored', 'confirmed') then
    raise exception 'invalid status: %', p_status;
  end if;

  update public.fraud_signal_alerts
     set review_status = p_status,
         reviewed_at   = case when p_status = 'open' then null else now() end,
         reviewed_note = p_note
   where id = p_alert_id;
end;
$$;

revoke all on function public.admin_set_fraud_alert_status(uuid, text, text) from public;
grant execute on function public.admin_set_fraud_alert_status(uuid, text, text) to authenticated, service_role, postgres;

-- ---------------------------------------------------------------------------
-- 2. Aggregated login geo points (GeoLite2 lat/lon) for the map. Points are
-- bucketed to ~2 decimal places (~1km) so nearby logins cluster into one pin.
-- ---------------------------------------------------------------------------
create or replace function public.admin_get_login_geo()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(x order by (x->>'account_count')::int desc), '[]'::jsonb)
    into result
  from (
    select jsonb_build_object(
             'lat', round(i.latitude::numeric, 2),
             'lon', round(i.longitude::numeric, 2),
             'city', max(i.city_name),
             'country', max(i.country_iso),
             'is_hosting', bool_or(i.is_hosting),
             'account_count', count(distinct i.user_id),
             'accounts', jsonb_agg(distinct jsonb_build_object(
                'user_id', u.id, 'username', u.username, 'role', u.user_role))
           ) as x
    from public.auth_ip_log i
    join public.users u on u.id = i.user_id
    where i.latitude is not null and i.longitude is not null
    group by round(i.latitude::numeric, 2), round(i.longitude::numeric, 2)
  ) s;

  return result;
end;
$$;

revoke all on function public.admin_get_login_geo() from public;
grant execute on function public.admin_get_login_geo() to authenticated, service_role, postgres;
