-- Admin "GrabFood vouchers" tab: where each claimant is and how to reach them on Facebook.
-- Location matters because a GrabFood PH voucher is useless outside the Philippines (some borrowers
-- are OFWs or in Indonesia). Returns, per user:
--   * KYC: ID-issuing country and the province/region + country of the KYC address (no street)
--   * latest login city/country, skipping hosting/VPN IPs, and every login country in the last 30 days
--   * Facebook name / profile link and whether Messenger is confirmed
-- Admin-gated, read-only.
create or replace function public.admin_voucher_contacts(p_user_ids uuid[])
returns table (
  user_id uuid,
  kyc_country text,
  kyc_area text,
  login_city text,
  login_country text,
  login_at timestamptz,
  login_countries text[],
  facebook_name text,
  facebook_contact text,
  messenger_verified boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    k.issuing_state,
    -- Last two address parts, postcodes stripped: "…, 6000 Cebu, Philippines" → "Cebu, Philippines".
    nullif(btrim(regexp_replace(regexp_replace(
      array_to_string((string_to_array(k.formatted_address, ','))[greatest(array_length(string_to_array(k.formatted_address, ','), 1) - 1, 1):], ','),
      '\s*\d{4,6}\s*', ' ', 'g'
    ), '\s*,\s*', ', ', 'g')), ''),
    last_login.city_name,
    last_login.country_iso,
    last_login.last_seen_at,
    coalesce(recent.countries, '{}'),
    u.facebook_name,
    u.facebook_contact,
    u.messenger_verified_at is not null
  from public.users u
  left join lateral (
    select ki.issuing_state, ki.formatted_address
    from public.kyc_identities ki
    where ki.user_id = u.id
    order by (ki.session_status = 'Approved') desc, (ki.formatted_address is not null) desc, ki.session_created_at desc nulls last
    limit 1
  ) k on true
  left join lateral (
    select a.city_name, a.country_iso, a.last_seen_at
    from public.auth_ip_log a
    where a.user_id = u.id and not coalesce(a.is_hosting, false) and a.country_iso is not null
    order by a.last_seen_at desc nulls last
    limit 1
  ) last_login on true
  left join lateral (
    select array_agg(c.country_iso order by c.n desc) as countries
    from (
      select a.country_iso, count(*) as n
      from public.auth_ip_log a
      where a.user_id = u.id and not coalesce(a.is_hosting, false) and a.country_iso is not null
        and a.last_seen_at > now() - interval '30 days'
      group by a.country_iso
    ) c
  ) recent on true
  where u.id = any (p_user_ids);
end;
$$;

revoke all on function public.admin_voucher_contacts(uuid[]) from public, anon;
grant execute on function public.admin_voucher_contacts(uuid[]) to authenticated;
