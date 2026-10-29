-- Didit Reusable KYC → Stableyard. Our borrowers already passed Didit KYC with us; instead of a second
-- KYC at Stableyard we mint a Didit share token for Stableyard's Didit application, which they import
-- on their side (POST /v3/session/import-shared/). Stableyard hasn't enabled the import yet: until
-- STABLEYARD_DIDIT_APP_ID is in the vault, sharing is a no-op that says "not configured".
--
-- Stableyard's Didit application ID (a UUID from their Didit Business Console) lives in the vault like
-- the webhook secret (edge-function secrets are at the cap). Store it with vault.create_secret, never here.
create or replace function public.stableyard_didit_app_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
   select decrypted_secret from vault.decrypted_secrets where name = 'STABLEYARD_DIDIT_APP_ID' limit 1;
$$;

revoke all on function public.stableyard_didit_app_id() from public, anon, authenticated;
grant execute on function public.stableyard_didit_app_id() to service_role;

-- One row per share minted. The token itself is never stored (it is a credential and expires in ≤24h).
create table if not exists public.stableyard_kyc_shares (
   id uuid primary key default gen_random_uuid(),
   user_id uuid not null references auth.users (id) on delete cascade,
   didit_session_id text not null,
   for_application_id text not null,
   session_kind text,
   ttl_seconds integer not null,
   delivered_at timestamptz,
   error text,
   created_at timestamptz not null default now()
);

create index if not exists stableyard_kyc_shares_user_idx on public.stableyard_kyc_shares (user_id, created_at desc);

alter table public.stableyard_kyc_shares enable row level security;
-- No policies: only the service role (edge functions) reads or writes it.
