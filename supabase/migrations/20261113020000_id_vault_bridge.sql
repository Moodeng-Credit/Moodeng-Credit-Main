-- Indonesia track: fund Indonesian loans from the BitRepo vault (USDC on Base) and send repayments back,
-- bridged with LI.FI by Moodeng's Openfort payout wallet (same address on Base and BNB Chain).
--
--   to_bsc  : admin draws from the vault to the payout wallet on Base → LI.FI → USDC on BNB Chain in the
--             same wallet → the existing auto-pay sends the borrower exactly the loan amount.
--   to_base : /idvault in Telegram → LI.FI → the payout wallet's USDT/USDC on BNB Chain → USDC on Base to
--             the lending wallet, which then pays the vault (Admin → Credit line → Pay vault).
--
-- One row per bridge; a loan is drawn for at most once (unique loan_id for to_bsc), a Telegram card sends
-- at most once (unique card_key).

create table if not exists public.id_vault_bridges (
  id bigserial primary key,
  direction text not null check (direction in ('to_bsc', 'to_base')),
  loan_id uuid references public.loans(id),
  card_key text unique,
  draw_tx text unique,
  from_token text not null,
  from_units text not null,           -- exact amount sent into LI.FI (source-chain units)
  to_token text not null,
  to_min_units text,                  -- LI.FI's guaranteed minimum on arrival (destination units)
  to_address text not null,
  openfort_tx text,
  src_tx text,                        -- source-chain tx hash
  dest_tx text,                       -- destination-chain tx hash (from LI.FI status)
  received_units text,
  status text not null default 'drawn'
    check (status in ('drawn', 'bridging', 'bridged', 'paid', 'failed', 'not_sent')),
  error text,
  by_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists id_vault_bridges_one_draw_per_loan
  on public.id_vault_bridges (loan_id) where direction = 'to_bsc';
create index if not exists id_vault_bridges_open
  on public.id_vault_bridges (status) where status in ('drawn', 'bridging', 'bridged');

alter table public.id_vault_bridges enable row level security;
revoke all on public.id_vault_bridges from public, anon, authenticated;

-- LI.FI API key (vault secret LIFI_API_KEY). Optional: without it LI.FI still answers, at a lower rate limit.
create or replace function public.lifi_api_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
   select decrypted_secret from vault.decrypted_secrets where name = 'LIFI_API_KEY' limit 1;
$$;

revoke all on function public.lifi_api_key() from public, anon, authenticated;
grant execute on function public.lifi_api_key() to service_role;
