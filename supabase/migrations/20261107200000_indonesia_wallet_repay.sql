-- Indonesia track: repaying straight to Moodeng's payout wallet on BNB Chain
-- (docs/INDONESIA_TRACK.md "Repaying", _shared/idRepayments.ts).
--
--   The borrower sends USDT (or USDC) on BNB Chain (BEP20) from Walt to the payout wallet — the same
--   Openfort wallet loans are paid from. No bridge, no fee taken from anyone's money.
--
--   Walt sends from its own shared wallets, so the sender can't tell us who paid. The AMOUNT does:
--   every repayment request gets an exact amount (what's owed, rounded up to the cent, plus 0–30 cents
--   when another open request already has that amount). No two OPEN requests ever share an amount
--   (unique index below).
--
--   id_repay_requests   one per "💰 Bayar" (bot) / "Dapatkan alamat" (app): loan, exact amount, 48 h.
--   id_wallet_deposits  every USDT/USDC transfer INTO the payout wallet, seen on BNB Chain by the
--                       5-minute job: matched to a request by exact amount and recorded on the loan
--                       (record_loan_payment 'repay', hash 'bsc:<tx>:<log index>'), a top-up from a
--                       known sender, or unmatched → the team decides with buttons in Telegram.
--
--   Service role only (the edge functions); no client access.

create table if not exists public.id_repay_requests (
  id bigserial primary key,
  loan_id uuid not null references public.loans(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  to_address text not null,                  -- the payout wallet when the request was made
  amount_units numeric(78, 0) not null check (amount_units > 0),  -- 18 decimals (BSC USDT and USDC)
  amount_usd numeric not null,
  owed_usd numeric not null,                 -- what was owed when asked (amount_usd − owed_usd = the cents bump)
  rupiah_left numeric,
  rate numeric,
  source text not null default 'telegram' check (source in ('telegram', 'app')),
  status text not null default 'open' check (status in ('open', 'paid', 'expired', 'replaced')),
  deposit_id bigint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  updated_at timestamptz not null default now()
);
create unique index if not exists id_repay_requests_open_amount_key on public.id_repay_requests (amount_units) where status = 'open';
create index if not exists id_repay_requests_loan_idx on public.id_repay_requests (loan_id, created_at desc);
create index if not exists id_repay_requests_recent_amount_idx on public.id_repay_requests (amount_units, created_at desc);

create table if not exists public.id_wallet_deposits (
  id bigserial primary key,
  tx_hash text not null,
  log_index integer not null check (log_index >= 0),
  token text not null check (token in ('USDT', 'USDC')),
  from_address text not null,
  to_address text not null,
  units numeric(78, 0) not null,
  block_number bigint not null,
  block_time timestamptz,
  -- new → recording → recorded | topup | unmatched | ignored | refund_needed → refunded
  status text not null default 'new'
    check (status in ('new', 'recording', 'recorded', 'topup', 'unmatched', 'ignored', 'refund_needed', 'refunded')),
  request_id bigint references public.id_repay_requests(id) on delete set null,
  loan_id uuid references public.loans(id) on delete set null,
  matched_by text,                           -- 'amount' | 'late_amount' | 'team'
  note jsonb,
  recording_at timestamptz,                  -- set just before record_loan_payment
  recorded_at timestamptz,                   -- set after the follow-ups (level-up, messages) ran
  alerted_at timestamptz,
  refund_started_at timestamptz,             -- claimed before a refund send (one tap only)
  refund_tx text,                            -- Openfort transaction id of the refund to their Walt
  refund_units numeric(78, 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tx_hash, log_index)
);
create index if not exists id_wallet_deposits_status_idx on public.id_wallet_deposits (status, created_at) where status in ('new', 'recording', 'unmatched');

alter table public.id_repay_requests enable row level security;
alter table public.id_wallet_deposits enable row level security;
revoke all on public.id_repay_requests, public.id_wallet_deposits from public, anon, authenticated;
revoke all on sequence public.id_repay_requests_id_seq, public.id_wallet_deposits_id_seq from public, anon, authenticated;

insert into public.telegram_bot_settings (key, value, description) values
  ('id_repay_scan_block', '',
   'Last BNB Chain block scanned for USDT/USDC into the Indonesia payout wallet (_shared/idRepayments.ts). Empty = start ~2 h back.'),
  ('id_topup_senders', '',
   'Comma-separated BNB Chain addresses whose transfers into the payout wallet are top-ups (e.g. Binance TH), not repayments. The "It''s a top-up" button adds to it.'),
  ('id_payout_sweep_to', '',
   'The ONLY address /idsweep can send payout-wallet money to (e.g. your Binance TH USDT/USDC BEP20 deposit address). Set by SQL, never from chat.'),
  ('id_sweep_lock', '',
   'Last /idsweep card that was sent (so a double tap can''t send twice).')
on conflict (key) do nothing;
