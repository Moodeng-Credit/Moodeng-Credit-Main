-- Application-time fraud signals: a device fingerprint + a GPS fix captured the
-- moment a borrower submits a loan request. The point is to catch a risky
-- application BEFORE it is ever funded (co-location with another account, a
-- device shared across accounts, a farm) instead of tracing the money after it
-- has already left.
--
-- PRIVACY: raw GPS coordinates are sensitive personal data (PH Data Privacy Act
-- RA 10173) and must NEVER reach the public `loans` row — lenders browse loan
-- requests with `select *`, so a lat/lon column there would leak every
-- borrower's home location to strangers. They live here in an admin-read-only
-- table, written only by a service-role edge function.

-- ---------------------------------------------------------------------------
-- 1. Device log — a salted hash of the client device fingerprint, per user per
--    day. Mirrors auth_ip_log exactly: device_hash is to the physical device
--    what ip_hash is to the network. This is what catches "one phone running
--    many borrower accounts".
-- ---------------------------------------------------------------------------
create table if not exists public.auth_device_log (
  user_id       uuid not null references public.users(id) on delete cascade,
  device_hash   text not null,
  seen_on       date not null default current_date,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (user_id, device_hash, seen_on)
);
create index if not exists auth_device_log_devicehash_idx on public.auth_device_log (device_hash);

alter table public.auth_device_log enable row level security;
drop policy if exists "admins read device log" on public.auth_device_log;
create policy "admins read device log" on public.auth_device_log
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- ---------------------------------------------------------------------------
-- 2. Per-application signal snapshot — one row per loan request holding the GPS
--    fix and device hash captured at submit time. Admin-read-only; the
--    borrower's own client never reads it back. Written by the
--    record-application-signals edge function under the service role.
-- ---------------------------------------------------------------------------
create table if not exists public.loan_application_signals (
  loan_id          uuid primary key references public.loans(id) on delete cascade,
  borrower_user_id uuid references public.users(id) on delete set null,
  app_lat          double precision,
  app_lon          double precision,
  app_gps_accuracy real,
  -- 'granted' | 'denied' | 'unavailable' | 'timeout'. We record WHY there's no
  -- fix, not just its absence: a denial is itself a (mild) signal worth keeping.
  app_gps_status   text,
  device_hash      text,
  created_at       timestamptz not null default now()
);
create index if not exists loan_application_signals_borrower_idx on public.loan_application_signals (borrower_user_id);
create index if not exists loan_application_signals_device_idx  on public.loan_application_signals (device_hash);

alter table public.loan_application_signals enable row level security;
drop policy if exists "admins read application signals" on public.loan_application_signals;
create policy "admins read application signals" on public.loan_application_signals
  for select to authenticated
  using (app_private.is_moodeng_admin());
