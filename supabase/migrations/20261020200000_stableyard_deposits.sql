-- Stableyard deposit addresses: "send from any chain, it lands as USDC on Base in your wallet".
--
-- Why this exists: the repay "Add funds" panel tells borrowers to withdraw from an exchange on the
-- Base network only, and a transfer on the wrong network (Tron, BNB, Solana, Ethereum…) is lost.
-- Stableyard gives each user persistent deposit addresses on those other chains; every transfer
-- that arrives is converted and settled as USDC on Base to the user's own wallet
-- (users.wallet_address), where the existing repay flow already watches the balance.
--
-- Nothing here touches loan money. A Stableyard deposit never credits a loan directly: it only
-- fills the borrower's wallet, and repayment still goes wallet → lender through
-- confirm-loan-payment. These tables are a mirror of what Stableyard reports, for the UI and admins.
--
-- All writes come from service-role edge functions (stableyard-deposit-address, stableyard-webhook).
-- Owners can read their own rows; admins can read everything.

-- ---------------------------------------------------------------------------
-- 1. One Stableyard Universal Payment Account per Moodeng user (externalUserId = users.id)
-- ---------------------------------------------------------------------------
create table if not exists public.stableyard_accounts (
   user_id            uuid primary key references public.users(id) on delete cascade,
   account_id         text not null unique,
   settlement_wallet  text,
   settlement_chain_id integer,
   created_at         timestamptz not null default now(),
   updated_at         timestamptz not null default now()
);

comment on table public.stableyard_accounts is
   'Stableyard UPA per user. settlement_wallet is the address deposits settle to (users.wallet_address at link time).';

-- ---------------------------------------------------------------------------
-- 2. Persistent deposit addresses (one per user per chain)
-- ---------------------------------------------------------------------------
create table if not exists public.stableyard_deposit_addresses (
   id            text primary key,                 -- deposit_addr_…
   user_id       uuid not null references public.users(id) on delete cascade,
   account_id    text not null,
   chain_id      integer not null,
   network_code  text,
   chain_family  text,
   address       text not null,
   assets        jsonb not null default '[]'::jsonb, -- [{symbol, tokenAddress, decimals, minimum}]
   status        text not null default 'active',
   created_at    timestamptz not null default now(),
   updated_at    timestamptz not null default now()
);

create index if not exists stableyard_deposit_addresses_user_idx on public.stableyard_deposit_addresses (user_id);
create index if not exists stableyard_deposit_addresses_address_idx on public.stableyard_deposit_addresses (lower(address));

-- ---------------------------------------------------------------------------
-- 3. Deposits Stableyard detected on those addresses. `status` mirrors Stableyard:
--    detected | confirming | settling | settled | reversed | failed | ignored | requires_intervention
--    Only `settled` means the USDC reached the user's wallet.
-- ---------------------------------------------------------------------------
create table if not exists public.stableyard_deposits (
   id                   text primary key,          -- deposit_…
   user_id              uuid not null references public.users(id) on delete cascade,
   account_id           text not null,
   deposit_address_id   text,
   status               text not null,
   source_chain_id      integer,
   asset_symbol         text,
   asset_decimals       integer,
   amount_atomic        text,
   net_amount_atomic    text,                      -- what the wallet receives after fees (null until known)
   net_asset_symbol     text,
   net_asset_decimals   integer,
   source_tx_hash       text,
   settlement_tx_hash   text,
   settlement_status    text,
   settlement_reason    text,
   observed_at          timestamptz,
   settled_at           timestamptz,
   notified_at          timestamptz,              -- set once we told the user it landed
   raw                  jsonb,
   created_at           timestamptz not null default now(),
   updated_at           timestamptz not null default now()
);

create index if not exists stableyard_deposits_user_idx on public.stableyard_deposits (user_id, created_at desc);
create index if not exists stableyard_deposits_status_idx on public.stableyard_deposits (status)
   where status in ('requires_intervention', 'failed');

-- ---------------------------------------------------------------------------
-- 4. Webhook event ledger — at-least-once delivery, dedupe on the event id.
-- ---------------------------------------------------------------------------
create table if not exists public.stableyard_webhook_events (
   event_id      text primary key,
   event_name    text not null,
   delivery_id   text,
   account_id    text,
   payload       jsonb,
   received_at   timestamptz not null default now(),
   processed_at  timestamptz,
   error         text
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.stableyard_accounts enable row level security;
alter table public.stableyard_deposit_addresses enable row level security;
alter table public.stableyard_deposits enable row level security;
alter table public.stableyard_webhook_events enable row level security;

drop policy if exists "owners read own stableyard account" on public.stableyard_accounts;
create policy "owners read own stableyard account" on public.stableyard_accounts
   for select to authenticated
   using (user_id = auth.uid() or app_private.is_moodeng_admin());

drop policy if exists "owners read own stableyard deposit addresses" on public.stableyard_deposit_addresses;
create policy "owners read own stableyard deposit addresses" on public.stableyard_deposit_addresses
   for select to authenticated
   using (user_id = auth.uid() or app_private.is_moodeng_admin());

drop policy if exists "owners read own stableyard deposits" on public.stableyard_deposits;
create policy "owners read own stableyard deposits" on public.stableyard_deposits
   for select to authenticated
   using (user_id = auth.uid() or app_private.is_moodeng_admin());

drop policy if exists "admins read stableyard webhook events" on public.stableyard_webhook_events;
create policy "admins read stableyard webhook events" on public.stableyard_webhook_events
   for select to authenticated
   using (app_private.is_moodeng_admin());

revoke all on table public.stableyard_accounts, public.stableyard_deposit_addresses, public.stableyard_deposits,
   public.stableyard_webhook_events from public, anon;
grant select on table public.stableyard_accounts, public.stableyard_deposit_addresses, public.stableyard_deposits,
   public.stableyard_webhook_events to authenticated;
grant all on table public.stableyard_accounts, public.stableyard_deposit_addresses, public.stableyard_deposits,
   public.stableyard_webhook_events to service_role;
