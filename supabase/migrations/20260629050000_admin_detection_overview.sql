-- Powers the admin "Self-lending?" page: cross-listings of accounts that share a
-- wallet, an IP, a subnet, or a canonical email, plus realized self-lending loans
-- (a borrower and lender that are linked accounts on the same loan). Admin-gated,
-- read-only, computed live so it reflects current data (whitelisted accounts are
-- still shown, just badged).

-- Collapse an email to its canonical form so Gmail dot/plus tricks
-- (a.b+test@gmail -> ab@gmail) don't spawn "different" addresses.
create or replace function app_private.canonical_email(addr text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when addr is null or btrim(addr) = '' then null
    when lower(split_part(addr, '@', 2)) in ('gmail.com', 'googlemail.com')
      then regexp_replace(split_part(split_part(lower(addr), '@', 1), '+', 1), '\.', '', 'g') || '@gmail.com'
    else lower(addr)
  end;
$$;

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

    -- 2+ accounts from the same /24 (or /48) network block
    'subnet_clusters', coalesce((
      select jsonb_agg(x order by (x->>'account_count')::int desc)
      from (
        select jsonb_build_object(
                 'subnet_hash_short', left(i.subnet_hash, 12),
                 'account_count', count(distinct i.user_id),
                 'all_whitelisted', bool_and(wl.user_id is not null),
                 'asn_org', max(i.asn_org),
                 'country', max(i.country_iso),
                 'accounts', jsonb_agg(distinct jsonb_build_object(
                    'user_id', u.id, 'username', u.username, 'role', u.user_role,
                    'whitelisted', wl.user_id is not null))
               ) as x
        from public.auth_ip_log i
        join public.users u on u.id = i.user_id
        left join public.fraud_detection_whitelist wl on wl.user_id = i.user_id
        where i.subnet_hash is not null
        group by i.subnet_hash
        having count(distinct i.user_id) > 1
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
          select u.id, u.username, u.email, app_private.canonical_email(u.email) as canonical_email
          from public.users u
          where coalesce(u.email, '') <> ''
        ) c
        left join public.fraud_detection_whitelist wl on wl.user_id = c.id
        group by c.canonical_email
        having count(*) > 1
      ) s
    ), '[]'::jsonb),

    -- Realized self-lending: loans whose borrower and lender are DIFFERENT accounts
    -- but linked by a shared wallet / IP / subnet / canonical email. The strongest
    -- signal — someone actually lending to themselves across two accounts. Each
    -- loan reports every link type found; 'wallet'/'email' are strong, 'ip'/'subnet'
    -- are circumstantial (could be a shared household/office).
    'self_lending_loans', coalesce((
      select jsonb_agg(x order by (x->>'created_at') desc)
      from (
        select jsonb_build_object(
                 'loan_id', l.id,
                 'tracking_id', l.tracking_id,
                 'loan_amount', l.loan_amount,
                 'coin', l.coin,
                 'loan_status', l.loan_status,
                 'created_at', l.created_at,
                 'borrower', jsonb_build_object(
                    'user_id', bu.id, 'username', bu.username, 'email', bu.email,
                    'whitelisted', wlb.user_id is not null),
                 'lender', jsonb_build_object(
                    'user_id', lu.id, 'username', lu.username, 'email', lu.email,
                    'whitelisted', wll.user_id is not null),
                 'links', links.arr,
                 'strongest', case
                    when links.arr ?| array['same_wallet_on_loan','shared_wallet','shared_email'] then 'strong'
                    else 'circumstantial'
                 end
               ) as x
        from public.loans l
        join public.users bu on bu.id = l.borrower_user_id
        join public.users lu on lu.id = l.lender_user_id
        left join public.fraud_detection_whitelist wlb on wlb.user_id = l.borrower_user_id
        left join public.fraud_detection_whitelist wll on wll.user_id = l.lender_user_id
        cross join lateral (
          select coalesce(jsonb_agg(distinct link), '[]'::jsonb) as arr
          from (
            select 'same_wallet_on_loan' as link
            where l.borrower_wallet is not null and l.lender_wallet is not null
              and lower(btrim(l.borrower_wallet)) = lower(btrim(l.lender_wallet))
            union all
            select 'shared_wallet'
            where exists (
              select 1 from public.wallet_usage_log wb
              join public.wallet_usage_log wl2 on wl2.wallet_address = wb.wallet_address
              where wb.user_id = l.borrower_user_id and wl2.user_id = l.lender_user_id
            )
            union all
            select 'shared_email'
            where app_private.canonical_email(bu.email) is not null
              and app_private.canonical_email(bu.email) = app_private.canonical_email(lu.email)
            union all
            select 'shared_ip'
            where exists (
              select 1 from public.auth_ip_log ib
              join public.auth_ip_log il2 on il2.ip_hash = ib.ip_hash
              where ib.user_id = l.borrower_user_id and il2.user_id = l.lender_user_id
            )
            union all
            select 'shared_subnet'
            where exists (
              select 1 from public.auth_ip_log ib
              join public.auth_ip_log il2 on il2.subnet_hash = ib.subnet_hash
              where ib.user_id = l.borrower_user_id and il2.user_id = l.lender_user_id
                and ib.subnet_hash is not null
            )
          ) found_links
        ) links
        where l.borrower_user_id is not null and l.lender_user_id is not null
          and l.borrower_user_id <> l.lender_user_id
          and jsonb_array_length(links.arr) > 0
      ) s
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_get_detection_overview() from public;
grant execute on function public.admin_get_detection_overview() to authenticated, service_role, postgres;
