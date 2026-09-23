-- KYC cross-check: keep the identity Didit extracted from every KYC attempt, and the matches
-- between different accounts (same ID number, same address, neighbours, same family + district,
-- Didit duplicate-face/device warnings).
--
-- Filled by the kyc-cross-check edge function, which pulls every Didit session (declined ones too —
-- a declined attempt with someone else's ID is exactly what caught the Suganda family), stores what
-- it hasn't seen, compares everyone, and reports new matches to Discord #kyc + the Telegram fraud
-- group. Runs daily at 01:00 UTC (08:00 Bangkok/Jakarta) and on demand.
--
-- Holds ID numbers and home addresses: admins can read, nobody else (service role writes).

create table if not exists public.kyc_identities (
  session_id uuid primary key,
  vendor_data text,
  user_id uuid references public.users (id) on delete set null,
  session_status text,
  session_created_at timestamptz,
  full_name text,
  first_name text,
  last_name text,
  date_of_birth date,
  document_type text,
  document_number text,
  issuing_state text,
  address text,
  formatted_address text,
  latitude double precision,
  longitude double precision,
  -- Google's location_type for the geocode. Only ROOFTOP / RANGE_INTERPOLATED are precise enough
  -- for distance matching; APPROXIMATE / GEOMETRIC_CENTER fall back to an area centroid that
  -- unrelated people share.
  geo_precision text,
  nik_district text,
  warnings text[] not null default '{}',
  fetched_at timestamptz not null default now()
);

create index if not exists kyc_identities_user_id_idx on public.kyc_identities (user_id);
create index if not exists kyc_identities_document_number_idx on public.kyc_identities (document_number);

create table if not exists public.kyc_identity_matches (
  id bigserial primary key,
  -- kind:session_a:session_b ('-' when single-session) — one row per pair per kind, across runs.
  pair_key text not null unique,
  kind text not null,
  severity text not null check (severity in ('red', 'orange')),
  session_a uuid not null references public.kyc_identities (session_id) on delete cascade,
  session_b uuid references public.kyc_identities (session_id) on delete cascade,
  user_a uuid references public.users (id) on delete set null,
  user_b uuid references public.users (id) on delete set null,
  detail text,
  distance_m integer,
  created_at timestamptz not null default now(),
  reported_at timestamptz
);


alter table public.kyc_identities enable row level security;
alter table public.kyc_identity_matches enable row level security;

drop policy if exists "admins read kyc identities" on public.kyc_identities;
create policy "admins read kyc identities" on public.kyc_identities for select using (app_private.is_moodeng_admin());

drop policy if exists "admins read kyc identity matches" on public.kyc_identity_matches;
create policy "admins read kyc identity matches" on public.kyc_identity_matches for select using (app_private.is_moodeng_admin());

-- Daily run, 01:00 UTC. Same caller pattern as sync_didit_user_status (vault URL + admin token).
select cron.unschedule('kyc-cross-check-daily') where exists (select 1 from cron.job where jobname = 'kyc-cross-check-daily');
select cron.schedule(
  'kyc-cross-check-daily',
  '0 1 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/kyc-cross-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := '{"report":"daily"}'::jsonb,
    timeout_milliseconds := 120000
  )
  $$
);
