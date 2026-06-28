-- Fraud-detection whitelist.
--
-- The accounts that exist at rollout are mostly the team testing the platform,
-- so they shouldn't generate fraud alerts. This whitelists every current account
-- and makes the scan skip any finding where ALL involved accounts are whitelisted.
-- New signups after this point are NOT whitelisted, so real abuse still surfaces.

create table if not exists public.fraud_detection_whitelist (
  user_id    uuid primary key references public.users(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now()
);

alter table public.fraud_detection_whitelist enable row level security;
drop policy if exists "admins manage whitelist" on public.fraud_detection_whitelist;
create policy "admins manage whitelist" on public.fraud_detection_whitelist
  for all to authenticated
  using (app_private.is_moodeng_admin())
  with check (app_private.is_moodeng_admin());

-- Whitelist every account that exists at rollout (admin / testing cohort).
insert into public.fraud_detection_whitelist (user_id, reason)
select id, 'rollout baseline: existing account at fraud-detection launch (admin/testing)'
from public.users
on conflict (user_id) do nothing;

-- Whitelist-aware scan: a finding is suppressed when every account it involves is
-- whitelisted. As soon as one non-whitelisted (real) account is involved, it fires.
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
begin
  -- A. Same wallet on 2+ accounts; skip if all those accounts are whitelisted
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

  -- D. Loan counterparties logged the same IP within the window; skip if both whitelisted
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

  return jsonb_build_object(
    'generated_at', now(),
    'new_signal_count', jsonb_array_length(new_signals),
    'signals', new_signals);
end;
$$;

revoke all on function public.scan_wallet_fraud_signals(integer) from public;
grant execute on function public.scan_wallet_fraud_signals(integer) to service_role, postgres;
