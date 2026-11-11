-- Stableyard Reusable KYC imports (POST /v2/accounts/{id}/kyc/imports). One row per attempt: it is
-- also the person's consent receipt (Stableyard requires us to keep one and send its reference).
-- The Didit share token is never stored. See supabase/functions/_shared/stableyardKycReuse.ts.
--
-- import_status: sharing (row made, token not sent yet) → submitting / imported (Stableyard's states)
-- | rejected | requires_reconciliation | failed (a clear 4xx: nothing was created, safe to retry)
-- | uncertain (5xx / timeout: don't redeem another token, Stableyard ops reconcile).
create table if not exists public.stableyard_kyc_imports (
   id uuid primary key default gen_random_uuid(),
   user_id uuid not null references auth.users (id) on delete cascade,
   account_id text not null,
   didit_session_id text not null,
   receiving_application_id text not null,
   consent_text text not null,
   our_consent_version text not null,
   consent_version text not null,
   consent_reference text,
   consented_at timestamptz not null default now(),
   policy_version integer,
   import_id text,
   import_status text not null default 'sharing',
   verification_status text,
   eligibility_status text,
   error text,
   created_at timestamptz not null default now(),
   updated_at timestamptz not null default now()
);

create index if not exists stableyard_kyc_imports_user_idx on public.stableyard_kyc_imports (user_id, account_id, created_at desc);

alter table public.stableyard_kyc_imports enable row level security;
-- No policies: only the service role (edge functions) reads or writes it.
