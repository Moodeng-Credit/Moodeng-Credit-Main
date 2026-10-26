-- confirm-loan-payment: alert the team only once per tx hash when a lender pays for a deleted loan.
-- Server-only (service role); no client access.
create table if not exists public.orphan_payment_alerts (
  tx_hash text primary key,
  created_at timestamptz not null default now()
);
alter table public.orphan_payment_alerts enable row level security;
revoke all on public.orphan_payment_alerts from anon, authenticated;
