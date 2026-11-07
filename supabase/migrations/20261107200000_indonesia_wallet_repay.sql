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
  refund_tx_hash text,                       -- the BNB Chain hash once Openfort confirms it
  refund_confirmed_at timestamptz,
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
  ('id_repay_scan_alerted_at', '',
   'When the team was last told the payout-wallet scan is behind (at most every 3 h).')
on conflict (key) do nothing;

-- Every /idsweep card sends at most once (the card key is the primary key).
create table if not exists public.id_sweeps (
  card_key text primary key,                 -- '<chat id>:<message id>'
  token text not null check (token in ('USDT', 'USDC')),
  cents bigint not null check (cents > 0),
  to_address text not null,
  openfort_tx text,
  status text not null default 'sending' check (status in ('sending', 'sent', 'confirmed', 'failed', 'not_sent')),
  tx_hash text,
  by_admin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.id_sweeps enable row level security;
revoke all on public.id_sweeps from public, anon, authenticated;

-- ── crediting the rupiah the borrower was asked for ─────────────────────────────────────────────
-- A repayment request is priced in USDT from the rupiah left at that moment. If the rate moves before
-- the money lands, converting the USDT at the new rate could leave a few hundred or thousand rupiah
-- "still owed" although the borrower paid exactly what we asked. So a deposit matched to a request
-- credits the REQUEST's rupiah (capped at what's still owed): record_id_wallet_repayment sets
-- moodeng.id_repay_credit_idr for this transaction and apply_idr_peg_on_repayment uses it instead of
-- the rate. Everything else (app payments, team-matched deposits) converts at the day's rate as before.
create or replace function app_private.apply_idr_peg_on_repayment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_rate numeric;
  v_left numeric;
  v_limit integer;
  v_credit numeric := nullif(current_setting('moodeng.id_repay_credit_idr', true), '')::numeric;
begin
  if new.repay_idr is null then
    return new;
  end if;
  if coalesce(new.repaid_amount, 0) <= coalesce(old.repaid_amount, 0) then
    return new;
  end if;
  if coalesce(old.repayment_status::text, '') = 'Paid' then
    return new;
  end if;

  v_rate := coalesce(public.current_usd_idr(), public.latest_usd_idr_any_age(), new.fx_rate_at_request);

  if new.repaid_idr is not distinct from old.repaid_idr then
    if v_credit is not null and v_credit > 0 then
      new.repaid_idr := round(coalesce(old.repaid_idr, 0)
        + least(v_credit, greatest(0, new.repay_idr - coalesce(old.repaid_idr, 0))), 2);
    elsif v_rate is not null and v_rate > 0 then
      new.repaid_idr := round(coalesce(old.repaid_idr, 0) + (new.repaid_amount - coalesce(old.repaid_amount, 0)) * v_rate, 2);
    else
      return new;
    end if;
  end if;

  if coalesce(new.repayment_status::text, '') = 'Paid' then
    return new;
  end if;

  v_left := greatest(0, new.repay_idr - new.repaid_idr);
  if v_left < 1000 then
    new.total_repayment_amount := new.repaid_amount;
    new.repayment_status := 'Paid'::public.repayment_status;
    new.repaid_at := coalesce(new.repaid_at, now());
    if new.credit_limit_at_repayment is null then
      select case when u.is_world_id::text = 'ACTIVE' or u.is_didit::text = 'ACTIVE'
                  then least(greatest(coalesce(u.cs, 0), 15), 140) end
        into v_limit
        from public.users as u
       where u.id = new.borrower_user_id;
      new.credit_limit_at_repayment := v_limit;
    end if;
  elsif v_rate is not null and v_rate > 0 then
    new.total_repayment_amount := round(new.repaid_amount + v_left / v_rate, 2);
  end if;
  return new;
end;
$$;

create or replace function public.record_id_wallet_repayment(
  p_loan_id uuid,
  p_caller uuid,
  p_hash text,
  p_amount_micros bigint,
  p_from text,
  p_credit_idr numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform set_config('moodeng.id_repay_credit_idr', coalesce(p_credit_idr::text, ''), true);
  v_result := public.record_loan_payment(p_loan_id, 'repay', p_caller, array[p_hash], p_hash, p_amount_micros, p_from);
  perform set_config('moodeng.id_repay_credit_idr', '', true);
  return v_result;
end;
$$;
revoke all on function public.record_id_wallet_repayment(uuid, uuid, text, bigint, text, numeric) from public, anon, authenticated;
grant execute on function public.record_id_wallet_repayment(uuid, uuid, text, bigint, text, numeric) to service_role;
