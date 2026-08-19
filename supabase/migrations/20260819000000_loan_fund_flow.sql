-- Follow-the-money (Part A of the anti-mule package).
--
-- Motivating incident (MoodengCreditFraudInvestigation.pdf, 2026-08-15): two separate
-- borrower accounts each drew a 15 USDC loan and, within hours, sent it to the SAME
-- Coins.ph deposit address (0x1792…Bb37). Coins.ph issues one deposit address per user,
-- so a single deposit address receiving from two "borrowers" means one beneficiary behind
-- both — a mule herder. That linking address is NOT in our database; it exists only
-- on-chain, one hop past the borrower wallet. None of the existing DB-join signals can see
-- it. This table records the on-chain destination of each loan's funds so the convergence
-- scan (scan_payout_convergence) can flag N distinct borrowers paying into one address.

-- ---------------------------------------------------------------------------
-- 1. Where each loan's USDC actually landed on-chain.
-- One row per (loan, terminal destination) — a loan can fan out to more than one.
-- ---------------------------------------------------------------------------
create table if not exists public.loan_fund_flow (
  loan_id             uuid not null references public.loans(id) on delete cascade,
  borrower_user_id    uuid references public.users(id) on delete set null,
  borrower_wallet     text,
  terminal_destination text not null,            -- external address funds landed on (lower-cased)
  destination_label   text,                      -- exchange name when known (e.g. "Coins.ph")
  is_exchange_deposit boolean not null default false,
  hop_count           integer not null default 1,
  tx_hashes           text[] not null default '{}',
  amount_out          numeric(38, 0) not null default 0,  -- raw USDC (6-decimals) summed to this dest
  funded_at           timestamptz,               -- when the loan was funded (from loans.funded_at)
  first_out_at        timestamptz,               -- first outbound hop toward this dest
  scanned_at          timestamptz not null default now(),
  primary key (loan_id, terminal_destination)
);

create index if not exists loan_fund_flow_dest_idx on public.loan_fund_flow (terminal_destination);
create index if not exists loan_fund_flow_borrower_idx on public.loan_fund_flow (borrower_user_id);

alter table public.loan_fund_flow enable row level security;
drop policy if exists "admins read loan fund flow" on public.loan_fund_flow;
create policy "admins read loan fund flow" on public.loan_fund_flow
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- ---------------------------------------------------------------------------
-- 2. Known exchange / off-ramp deposit addresses, so we can label a terminal
-- destination and mark is_exchange_deposit. Seeded from the addresses users have
-- already withdrawn to through the in-app flow (self-reported but labeled), then
-- grown by hand / by the tracer over time.
-- ---------------------------------------------------------------------------
create table if not exists public.known_exchange_addresses (
  address    text primary key,          -- lower-cased on-chain address
  label      text not null,             -- exchange name
  source     text not null default 'manual',
  created_at timestamptz not null default now()
);

alter table public.known_exchange_addresses enable row level security;
drop policy if exists "admins read known exchange addresses" on public.known_exchange_addresses;
create policy "admins read known exchange addresses" on public.known_exchange_addresses
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- Seed from the in-app withdrawal history (destination_address is the exchange deposit
-- address, exchange is its label). Lower-cased; skip anything already present.
insert into public.known_exchange_addresses (address, label, source)
select lower(btrim(w.destination_address)),
       max(w.exchange),
       'withdrawals_seed'
from public.withdrawals w
where w.destination_address is not null and btrim(w.destination_address) <> ''
group by lower(btrim(w.destination_address))
on conflict (address) do nothing;

-- The Coins.ph deposit address from the 2026-08-15 incident, so a re-run of the tracer
-- labels it immediately even before it reappears in withdrawals.
insert into public.known_exchange_addresses (address, label, source)
values ('0x1792240eb745b7dbc638744e5191004a2361bb37', 'Coins.ph', 'incident_2026_08_15')
on conflict (address) do nothing;
