-- Fix: the daily fraud scan (fraud-signal-scan edge fn -> scan_wallet_fraud_signals) has thrown
-- "function abs(interval) does not exist" on every run since 20260629040000 introduced the
-- impossible-travel check: `abs(b.last_seen_at - a.last_seen_at)` produces an interval, and
-- Postgres has no abs(interval). Signals A-E never commit either, because the whole call aborts.
--
-- The function body below is identical to 20260629040000 except hours_apart now takes abs() of
-- the extracted epoch (a double) instead of the interval.

create or replace function public.scan_wallet_fraud_signals(ip_window_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_signals jsonb := '[]'::jsonb;
  rec record;
  key text;
  dist_km double precision;
  hours_gap double precision;
begin
  -- A. Same wallet on 2+ accounts; skip if all whitelisted
  for rec in
    select w.wallet_address,
           jsonb_agg(distinct jsonb_build_object(
             'user_id', w.user_id, 'role', u.user_role, 'email', u.email, 'username', u.username)) as accounts,
           count(distinct w.user_id) as account_count,
           bool_or(u.user_role::text = 'borrower') as has_borrower,
           bool_or(u.user_role::text = 'lender')   as has_lender
    from public.wallet_usage_log w
    join public.users u on u.id = w.user_id
    left join public.fraud_detection_whitelist wl on wl.user_id = w.user_id
    group by w.wallet_address
    having count(distinct w.user_id) > 1
       and bool_or(wl.user_id is null)
  loop
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'shared_wallet' and a.subject_key = rec.wallet_address) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('shared_wallet', rec.wallet_address,
              jsonb_build_object('wallet_address', rec.wallet_address, 'accounts', rec.accounts,
                                 'account_count', rec.account_count,
                                 'borrower_and_lender', rec.has_borrower and rec.has_lender));
      new_signals := new_signals || jsonb_build_object(
        'type', 'shared_wallet',
        'severity', case when rec.has_borrower and rec.has_lender then 'critical' else 'warning' end,
        'wallet_address', rec.wallet_address, 'account_count', rec.account_count,
        'borrower_and_lender', rec.has_borrower and rec.has_lender, 'accounts', rec.accounts);
    end if;
  end loop;

  -- B. Self-deal; skip if both sides whitelisted
  for rec in
    select l.id as loan_id, l.tracking_id, lower(btrim(l.lender_wallet)) as wallet
    from public.loans l
    left join public.fraud_detection_whitelist wll on wll.user_id = l.lender_user_id
    left join public.fraud_detection_whitelist wlb on wlb.user_id = l.borrower_user_id
    where l.lender_wallet is not null and l.borrower_wallet is not null
      and lower(btrim(l.lender_wallet)) = lower(btrim(l.borrower_wallet))
      and (wll.user_id is null or wlb.user_id is null)
  loop
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'self_deal_wallet' and a.subject_key = rec.loan_id::text) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('self_deal_wallet', rec.loan_id::text,
              jsonb_build_object('loan_id', rec.loan_id, 'tracking_id', rec.tracking_id, 'wallet', rec.wallet));
      new_signals := new_signals || jsonb_build_object(
        'type', 'self_deal_wallet', 'severity', 'critical',
        'loan_id', rec.loan_id, 'tracking_id', rec.tracking_id, 'wallet', rec.wallet);
    end if;
  end loop;

  -- C. Loan counterparties share a wallet; skip if both whitelisted
  for rec in
    select l.id as loan_id, l.tracking_id, wl.wallet_address
    from public.loans l
    join public.wallet_usage_log wl on wl.user_id = l.lender_user_id
    join public.wallet_usage_log wb on wb.user_id = l.borrower_user_id
                                   and wb.wallet_address = wl.wallet_address
    left join public.fraud_detection_whitelist wll on wll.user_id = l.lender_user_id
    left join public.fraud_detection_whitelist wlb on wlb.user_id = l.borrower_user_id
    where l.lender_user_id is not null and l.borrower_user_id is not null
      and l.lender_user_id <> l.borrower_user_id
      and (wll.user_id is null or wlb.user_id is null)
    group by l.id, l.tracking_id, wl.wallet_address
  loop
    key := rec.loan_id::text || ':' || rec.wallet_address;
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'counterparty_shared_wallet' and a.subject_key = key) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('counterparty_shared_wallet', key,
              jsonb_build_object('loan_id', rec.loan_id, 'tracking_id', rec.tracking_id, 'wallet', rec.wallet_address));
      new_signals := new_signals || jsonb_build_object(
        'type', 'counterparty_shared_wallet', 'severity', 'critical',
        'loan_id', rec.loan_id, 'tracking_id', rec.tracking_id, 'wallet', rec.wallet_address);
    end if;
  end loop;

  -- D. Loan counterparties share an IP; skip if both whitelisted
  for rec in
    select l.id as loan_id, l.tracking_id, il.ip_hash
    from public.loans l
    join public.auth_ip_log il on il.user_id = l.lender_user_id
    join public.auth_ip_log ib on ib.user_id = l.borrower_user_id and ib.ip_hash = il.ip_hash
    left join public.fraud_detection_whitelist wll on wll.user_id = l.lender_user_id
    left join public.fraud_detection_whitelist wlb on wlb.user_id = l.borrower_user_id
    where l.lender_user_id is not null and l.borrower_user_id is not null
      and l.lender_user_id <> l.borrower_user_id
      and il.last_seen_at >= now() - make_interval(days => ip_window_days)
      and ib.last_seen_at >= now() - make_interval(days => ip_window_days)
      and (wll.user_id is null or wlb.user_id is null)
    group by l.id, l.tracking_id, il.ip_hash
  loop
    key := rec.loan_id::text || ':' || rec.ip_hash;
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'counterparty_shared_ip' and a.subject_key = key) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('counterparty_shared_ip', key,
              jsonb_build_object('loan_id', rec.loan_id, 'tracking_id', rec.tracking_id, 'ip_hash', rec.ip_hash));
      new_signals := new_signals || jsonb_build_object(
        'type', 'counterparty_shared_ip', 'severity', 'warning',
        'loan_id', rec.loan_id, 'tracking_id', rec.tracking_id);
    end if;
  end loop;

  -- E. Login from a datacenter / hosting IP (GeoLite2 ASN heuristic)
  for rec in
    select i.user_id, u.username, u.email, i.asn_org, i.country_iso,
           count(*) as hosting_logins
    from public.auth_ip_log i
    join public.users u on u.id = i.user_id
    left join public.fraud_detection_whitelist wl on wl.user_id = i.user_id
    where i.is_hosting = true
      and i.last_seen_at >= now() - make_interval(days => ip_window_days)
      and wl.user_id is null
    group by i.user_id, u.username, u.email, i.asn_org, i.country_iso
  loop
    key := rec.user_id::text || ':' || coalesce(rec.asn_org, 'unknown');
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'datacenter_ip' and a.subject_key = key) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('datacenter_ip', key,
              jsonb_build_object('user_id', rec.user_id, 'username', rec.username,
                                 'email', rec.email, 'asn_org', rec.asn_org,
                                 'country_iso', rec.country_iso,
                                 'hosting_logins', rec.hosting_logins));
      new_signals := new_signals || jsonb_build_object(
        'type', 'datacenter_ip', 'severity', 'warning',
        'user_id', rec.user_id, 'username', rec.username,
        'asn_org', rec.asn_org, 'hosting_logins', rec.hosting_logins);
    end if;
  end loop;

  -- F. Impossible travel: same user, two IPs on the same day with locations
  --    >500 km apart and <2 hours between last_seen_at timestamps.
  for rec in
    select a.user_id, u.username, u.email,
           a.country_iso as country_a, a.city_name as city_a,
           b.country_iso as country_b, b.city_name as city_b,
           a.last_seen_at as time_a, b.last_seen_at as time_b,
           2 * 6371 * asin(sqrt(
             power(sin(radians(b.latitude - a.latitude) / 2), 2) +
             cos(radians(a.latitude)) * cos(radians(b.latitude)) *
             power(sin(radians(b.longitude - a.longitude) / 2), 2)
           )) as distance_km,
           abs(extract(epoch from (b.last_seen_at - a.last_seen_at))) / 3600.0 as hours_apart
    from public.auth_ip_log a
    join public.auth_ip_log b on b.user_id = a.user_id
                              and b.ip_hash > a.ip_hash
                              and b.seen_on = a.seen_on
    join public.users u on u.id = a.user_id
    left join public.fraud_detection_whitelist wl on wl.user_id = a.user_id
    where a.latitude is not null and b.latitude is not null
      and a.seen_on >= current_date - ip_window_days
      and wl.user_id is null
  loop
    hours_gap := greatest(rec.hours_apart, 0.01);
    dist_km := coalesce(rec.distance_km, 0);
    if dist_km > 500 and (dist_km / hours_gap) > 900 then
      key := rec.user_id::text || ':' || rec.time_a::text || ':' || rec.time_b::text;
      if not exists (select 1 from public.fraud_signal_alerts a
                     where a.signal_type = 'impossible_travel' and a.subject_key = key) then
        insert into public.fraud_signal_alerts (signal_type, subject_key, details)
        values ('impossible_travel', key,
                jsonb_build_object('user_id', rec.user_id, 'username', rec.username,
                                   'email', rec.email,
                                   'location_a', coalesce(rec.city_a, '') || ', ' || coalesce(rec.country_a, ''),
                                   'location_b', coalesce(rec.city_b, '') || ', ' || coalesce(rec.country_b, ''),
                                   'distance_km', round(dist_km::numeric),
                                   'hours_apart', round(hours_gap::numeric, 1)));
        new_signals := new_signals || jsonb_build_object(
          'type', 'impossible_travel', 'severity', 'critical',
          'user_id', rec.user_id, 'username', rec.username,
          'location_a', coalesce(rec.city_a, '') || ', ' || coalesce(rec.country_a, ''),
          'location_b', coalesce(rec.city_b, '') || ', ' || coalesce(rec.country_b, ''),
          'distance_km', round(dist_km::numeric),
          'hours_apart', round(hours_gap::numeric, 1));
      end if;
    end if;
  end loop;

  -- G. Subnet clustering: 3+ accounts logging in from the same /24 (or /48) block
  --    within the window. Catches farms that rotate IPs inside one block even when
  --    no two full IPs match. Skip if every account in the block is whitelisted.
  for rec in
    select i.subnet_hash,
           count(distinct i.user_id) as account_count,
           max(i.asn_org) as asn_org,
           max(i.country_iso) as country_iso,
           jsonb_agg(distinct jsonb_build_object(
             'user_id', i.user_id, 'username', u.username, 'role', u.user_role)) as accounts
    from public.auth_ip_log i
    join public.users u on u.id = i.user_id
    left join public.fraud_detection_whitelist wl on wl.user_id = i.user_id
    where i.subnet_hash is not null
      and i.last_seen_at >= now() - make_interval(days => ip_window_days)
    group by i.subnet_hash
    having count(distinct i.user_id) >= 3
       and bool_or(wl.user_id is null)
  loop
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'subnet_cluster' and a.subject_key = rec.subnet_hash) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('subnet_cluster', rec.subnet_hash,
              jsonb_build_object('subnet_hash', rec.subnet_hash, 'account_count', rec.account_count,
                                 'asn_org', rec.asn_org, 'country_iso', rec.country_iso,
                                 'accounts', rec.accounts));
      new_signals := new_signals || jsonb_build_object(
        'type', 'subnet_cluster', 'severity', 'warning',
        'subnet_hash', rec.subnet_hash, 'account_count', rec.account_count,
        'asn_org', rec.asn_org, 'accounts', rec.accounts);
    end if;
  end loop;

  return jsonb_build_object(
    'generated_at', now(),
    'new_signal_count', jsonb_array_length(new_signals),
    'signals', new_signals);
end;
$$;

revoke all on function public.scan_wallet_fraud_signals(integer) from public;
grant execute on function public.scan_wallet_fraud_signals(integer) to service_role, postgres;
