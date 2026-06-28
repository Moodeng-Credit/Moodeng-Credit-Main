-- Powers the admin "Detection" page: cross-listings of accounts that share a
-- wallet, an IP, or a canonical email. Admin-gated, read-only, computed live so
-- it reflects current data (whitelisted accounts are still shown, just badged).

create or replace function public.admin_get_detection_overview()
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

  select jsonb_build_object(
    'generated_at', now(),

    -- Same wallet used by 2+ accounts
    'shared_wallets', coalesce((
      select jsonb_agg(x order by (x->>'account_count')::int desc)
      from (
        select jsonb_build_object(
                 'wallet_address', w.wallet_address,
                 'account_count', count(distinct w.user_id),
                 'all_whitelisted', bool_and(wl.user_id is not null),
                 'has_borrower', bool_or(u.user_role::text = 'borrower'),
                 'has_lender', bool_or(u.user_role::text = 'lender'),
                 'accounts', jsonb_agg(distinct jsonb_build_object(
                    'user_id', u.id, 'username', u.username, 'email', u.email,
                    'role', u.user_role, 'whitelisted', wl.user_id is not null))
               ) as x
        from public.wallet_usage_log w
        join public.users u on u.id = w.user_id
        left join public.fraud_detection_whitelist wl on wl.user_id = w.user_id
        group by w.wallet_address
        having count(distinct w.user_id) > 1
      ) s
    ), '[]'::jsonb),

    -- Same IP (hashed) used by 2+ accounts
    'shared_ips', coalesce((
      select jsonb_agg(x order by (x->>'account_count')::int desc)
      from (
        select jsonb_build_object(
                 'ip_hash_short', left(i.ip_hash, 12),
                 'account_count', count(distinct i.user_id),
                 'all_whitelisted', bool_and(wl.user_id is not null),
                 'country', max(i.country_iso),
                 'city', max(i.city_name),
                 'asn_org', max(i.asn_org),
                 'is_hosting', bool_or(i.is_hosting),
                 'accounts', jsonb_agg(distinct jsonb_build_object(
                    'user_id', u.id, 'username', u.username, 'role', u.user_role,
                    'whitelisted', wl.user_id is not null))
               ) as x
        from public.auth_ip_log i
        join public.users u on u.id = i.user_id
        left join public.fraud_detection_whitelist wl on wl.user_id = i.user_id
        group by i.ip_hash
        having count(distinct i.user_id) > 1
      ) s
    ), '[]'::jsonb),

    -- Logins from datacenter / hosting IPs
    'hosting_ips', coalesce((
      select jsonb_agg(x order by (x->>'login_count')::int desc)
      from (
        select jsonb_build_object(
                 'user_id', u.id, 'username', u.username, 'email', u.email,
                 'asn_org', i.asn_org, 'country', i.country_iso,
                 'login_count', count(*),
                 'whitelisted', wl.user_id is not null
               ) as x
        from public.auth_ip_log i
        join public.users u on u.id = i.user_id
        left join public.fraud_detection_whitelist wl on wl.user_id = i.user_id
        where i.is_hosting = true
        group by u.id, u.username, u.email, i.asn_org, i.country_iso, wl.user_id
      ) s
    ), '[]'::jsonb),

    -- Accounts whose canonical email collides (Gmail dot/plus tricks collapsed)
    'email_collisions', coalesce((
      select jsonb_agg(x order by (x->>'account_count')::int desc)
      from (
        select jsonb_build_object(
                 'canonical_email', c.canonical_email,
                 'account_count', count(*),
                 'accounts', jsonb_agg(jsonb_build_object(
                    'user_id', c.id, 'username', c.username, 'email', c.email,
                    'whitelisted', wl.user_id is not null))
               ) as x
        from (
          select u.id, u.username, u.email,
                 case
                   when lower(split_part(u.email, '@', 2)) in ('gmail.com', 'googlemail.com')
                     then regexp_replace(split_part(split_part(lower(u.email), '@', 1), '+', 1), '\.', '', 'g') || '@gmail.com'
                   else lower(u.email)
                 end as canonical_email
          from public.users u
          where coalesce(u.email, '') <> ''
        ) c
        left join public.fraud_detection_whitelist wl on wl.user_id = c.id
        group by c.canonical_email
        having count(*) > 1
      ) s
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_get_detection_overview() from public;
grant execute on function public.admin_get_detection_overview() to authenticated, service_role, postgres;
