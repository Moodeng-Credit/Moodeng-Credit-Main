-- Self-paid gas for Instant Wallets (2026-11-23).
--
-- Openfort's gas credit kept vanishing (billing $6 used vs $5 actually sponsored, $0.01 left), so
-- every Instant Wallet repay/cash-out failed. Fallback: the borrower's smart account pays its own
-- gas in ETH, and a Moodeng hot wallet drips a few cents of ETH into it right before a send.
-- The drip lives in the openfort-shield-session edge function (action "gas_prep").
--
-- Switch: telegram_bot_settings.openfort_self_gas (JSON)
--   {"mode":"test","user_ids":["<uuid>"]}  → only those users self-pay (the rest stay sponsored)
--   {"mode":"all"}                          → everyone self-pays
--   {"mode":"off"}                          → back to Openfort sponsorship
-- Optional numbers (wei, as strings): min_wei (top up when below), drip_wei (amount sent),
-- per_user_daily, global_daily (drip caps).

-- One row per ETH drip, for caps and the audit trail.
create table if not exists public.gas_drips (
   id bigserial primary key,
   user_id uuid not null,
   wallet_address text not null,
   amount_wei numeric not null,
   tx_hash text,
   created_at timestamptz not null default now()
);
create index if not exists gas_drips_user_created on public.gas_drips (user_id, created_at desc);
create index if not exists gas_drips_created on public.gas_drips (created_at desc);
alter table public.gas_drips enable row level security;
-- No policies: service role only.

-- The hot wallet's private key lives in the vault as OPENFORT_GAS_WALLET. The edge function creates
-- it on first use (so the key never passes through a chat, log or the repo) and only ever reads it
-- back through these two service-role-only functions.
create or replace function public.gas_wallet_key()
returns text
language sql
security definer
set search_path = public, vault
as $$
   select decrypted_secret from vault.decrypted_secrets where name = 'OPENFORT_GAS_WALLET' limit 1;
$$;

create or replace function public.set_gas_wallet_key(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, vault
as $$
begin
   -- Never overwrite: a second key would strand whatever ETH the first one holds.
   if exists (select 1 from vault.secrets where name = 'OPENFORT_GAS_WALLET') then
      return false;
   end if;
   perform vault.create_secret(p_key, 'OPENFORT_GAS_WALLET', 'Moodeng hot wallet that drips ETH gas into Instant Wallets');
   return true;
end;
$$;

revoke all on function public.gas_wallet_key() from public, anon, authenticated;
revoke all on function public.set_gas_wallet_key(text) from public, anon, authenticated;
grant execute on function public.gas_wallet_key() to service_role;
grant execute on function public.set_gas_wallet_key(text) to service_role;

insert into public.telegram_bot_settings (key, value, description)
values ('openfort_self_gas', '{"mode":"test","user_ids":[]}', 'Instant Wallet gas: off = Openfort pays, test = listed users pay own gas, all = everyone pays own gas (ETH dripped from OPENFORT_GAS_WALLET)')
on conflict (key) do nothing;
