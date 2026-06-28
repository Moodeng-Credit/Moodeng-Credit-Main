-- Wallet fraud detection (detection, not prevention — zero UX friction).
--
-- Context: lenders are intentionally NOT locked to a single wallet (funding uses
-- the live-connected wallet; repayment uses the per-loan lender_wallet snapshot).
-- That means we can't, and shouldn't, block multi-account abuse at the wallet
-- layer. Instead we observe and alert: keep a history of every wallet each account
-- has used, a salted-hash log of login IPs, and a daily scan that emails the
-- founder when two accounts share a wallet or an IP — especially a borrower and a
-- lender, i.e. someone lending to themselves across accounts.

-- ---------------------------------------------------------------------------
-- 1. Wallet-usage ledger
-- The active wallet still lives on users.wallet_address (overwritten on change).
-- This append-only table keeps the history that overwrite erases, normalized to
-- lowercase so addresses match regardless of EIP-55 checksum casing.
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_usage_log (
  user_id       uuid not null references public.users(id) on delete cascade,
  wallet_address text not null,
  role          text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  use_count     integer not null default 1,
  primary key (user_id, wallet_address)
);
create index if not exists wallet_usage_log_wallet_idx on public.wallet_usage_log (wallet_address);

alter table public.wallet_usage_log enable row level security;
drop policy if exists "admins read wallet usage" on public.wallet_usage_log;
create policy "admins read wallet usage" on public.wallet_usage_log
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- Trigger: log the active wallet whenever it is set or changed. SECURITY DEFINER
-- so it writes regardless of the caller's RLS context.
create or replace function app_private.log_wallet_usage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.wallet_address is null or btrim(new.wallet_address) = '' then
    return new;
  end if;

  insert into public.wallet_usage_log (user_id, wallet_address, role)
  values (new.id, lower(btrim(new.wallet_address)), new.user_role::text)
  on conflict (user_id, wallet_address)
  do update set last_seen_at = now(),
                use_count    = wallet_usage_log.use_count + 1,
                role         = excluded.role;

  return new;
end;
$$;

drop trigger if exists log_wallet_usage_on_users on public.users;
create trigger log_wallet_usage_on_users
  after insert or update of wallet_address on public.users
  for each row execute function app_private.log_wallet_usage();

-- Backfill history from current active wallets + every wallet that has touched a
-- loan, so detection has signal on day one.
insert into public.wallet_usage_log (user_id, wallet_address, role)
select u.id, lower(btrim(u.wallet_address)), u.user_role::text
from public.users u
where u.wallet_address is not null and btrim(u.wallet_address) <> ''
on conflict (user_id, wallet_address) do nothing;

insert into public.wallet_usage_log (user_id, wallet_address, role)
select l.lender_user_id, lower(btrim(l.lender_wallet)), 'lender'
from public.loans l
where l.lender_user_id is not null and l.lender_wallet is not null and btrim(l.lender_wallet) <> ''
on conflict (user_id, wallet_address) do nothing;

insert into public.wallet_usage_log (user_id, wallet_address, role)
select l.borrower_user_id, lower(btrim(l.borrower_wallet)), 'borrower'
from public.loans l
where l.borrower_user_id is not null and l.borrower_wallet is not null and btrim(l.borrower_wallet) <> ''
on conflict (user_id, wallet_address) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Hashed-IP log
-- We never store raw IPs. The record-session-ip edge function writes a
-- sha256(salt + ip) here per (user, ip, day). Used only to spot a borrower and a
-- lender on the same loan logging in from the same place.
-- ---------------------------------------------------------------------------
create table if not exists public.auth_ip_log (
  user_id      uuid not null references public.users(id) on delete cascade,
  ip_hash      text not null,
  seen_on      date not null default current_date,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, ip_hash, seen_on)
);
create index if not exists auth_ip_log_iphash_idx on public.auth_ip_log (ip_hash);

alter table public.auth_ip_log enable row level security;
drop policy if exists "admins read ip log" on public.auth_ip_log;
create policy "admins read ip log" on public.auth_ip_log
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- ---------------------------------------------------------------------------
-- 3. Alert dedup
-- Records every finding we've already surfaced, so the daily scan only emails
-- NEW signals (no daily repeats / alert fatigue).
-- ---------------------------------------------------------------------------
create table if not exists public.fraud_signal_alerts (
  id          uuid primary key default gen_random_uuid(),
  signal_type text not null,
  subject_key text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (signal_type, subject_key)
);

alter table public.fraud_signal_alerts enable row level security;
drop policy if exists "admins read fraud alerts" on public.fraud_signal_alerts;
create policy "admins read fraud alerts" on public.fraud_signal_alerts
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- ---------------------------------------------------------------------------
-- 4. The scan: returns ONLY signals not seen before, and records them so they
-- don't re-fire. Called by the fraud-signal-scan edge function.
-- ---------------------------------------------------------------------------
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
  -- A. Same wallet used by 2+ accounts (critical when it spans a borrower and a lender)
  for rec in
    select w.wallet_address,
           jsonb_agg(distinct jsonb_build_object(
             'user_id', w.user_id, 'role', u.user_role, 'email', u.email, 'username', u.username)) as accounts,
           count(distinct w.user_id) as account_count,
           bool_or(u.user_role::text = 'borrower') as has_borrower,
           bool_or(u.user_role::text = 'lender')   as has_lender
    from public.wallet_usage_log w
    join public.users u on u.id = w.user_id
    group by w.wallet_address
    having count(distinct w.user_id) > 1
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

  -- B. Self-deal: a single loan whose lender and borrower wallet are identical
  for rec in
    select l.id as loan_id, l.tracking_id, lower(btrim(l.lender_wallet)) as wallet
    from public.loans l
    where l.lender_wallet is not null and l.borrower_wallet is not null
      and lower(btrim(l.lender_wallet)) = lower(btrim(l.borrower_wallet))
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

  -- C. Loan counterparties share a wallet somewhere in their history
  for rec in
    select l.id as loan_id, l.tracking_id, wl.wallet_address
    from public.loans l
    join public.wallet_usage_log wl on wl.user_id = l.lender_user_id
    join public.wallet_usage_log wb on wb.user_id = l.borrower_user_id
                                   and wb.wallet_address = wl.wallet_address
    where l.lender_user_id is not null and l.borrower_user_id is not null
      and l.lender_user_id <> l.borrower_user_id
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

  -- D. Loan counterparties logged the same IP within the window
  for rec in
    select l.id as loan_id, l.tracking_id, il.ip_hash
    from public.loans l
    join public.auth_ip_log il on il.user_id = l.lender_user_id
    join public.auth_ip_log ib on ib.user_id = l.borrower_user_id and ib.ip_hash = il.ip_hash
    where l.lender_user_id is not null and l.borrower_user_id is not null
      and l.lender_user_id <> l.borrower_user_id
      and il.last_seen_at >= now() - make_interval(days => ip_window_days)
      and ib.last_seen_at >= now() - make_interval(days => ip_window_days)
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

-- ---------------------------------------------------------------------------
-- 5. Daily cron -> fraud-signal-scan edge function (which emails the founder)
-- ---------------------------------------------------------------------------
do $$
begin
  perform cron.unschedule('wallet-fraud-signal-scan-daily');
exception
  when others then null;
end $$;

select cron.schedule(
  'wallet-fraud-signal-scan-daily',
  '45 0 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/fraud-signal-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
