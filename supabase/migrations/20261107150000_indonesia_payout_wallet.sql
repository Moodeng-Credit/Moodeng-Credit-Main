-- Indonesia track: the Openfort payout wallet. Moodeng owns ONE Openfort backend wallet on BNB Smart
-- Chain (chainId 56), topped up with USDC (BSC) from Binance TH. When an Indonesian request is open,
-- the server sends USDC from it straight to the borrower's Walt address (gas paid by an Openfort fee
-- sponsorship), then records the loan funded exactly like a manual payout
-- (_shared/idManualFunding.ts runAutoPayouts / payNow, _shared/idPayoutWallet.ts).
--
--   Never pay twice: a loan is claimed BEFORE Openfort is called, by claim_id_auto_payout() below —
--   one transaction, serialized by an advisory lock, that moves the loan's id_manual_payouts row
--   from 'waiting' (nobody tapped "I sent it") to 'paying'. A 'paying' row is never sent again; the
--   next run only polls its openfort_tx_id. The manual "I sent it" / TxID / scan paths skip 'paying'.
--
--   Switch: /idautopay on|off in the admin Telegram group (id_autopay). Limits: id_autopay_max_usd
--   per loan, id_autopay_daily_cap_usd per Bangkok day.

-- Openfort credentials live in the DB vault as ONE JSON secret (edge-function secrets are at the
-- 100 cap): {"secretKey":"sk_live_…","walletSecret":"…","feeSponsorshipId":"pol_…"}.
-- The value is stored with vault.create_secret by hand (never in a migration).
create or replace function public.openfort_payout_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
   select decrypted_secret from vault.decrypted_secrets where name = 'OPENFORT_PAYOUT' limit 1;
$$;

revoke all on function public.openfort_payout_secret() from public, anon, authenticated;
grant execute on function public.openfort_payout_secret() to service_role;

insert into public.telegram_bot_settings (key, value, description) values
  ('id_autopay', 'off', 'Indonesia payout wallet: off | on. On = open Indonesian requests are paid automatically from the Openfort payout wallet (/idautopay on|off).'),
  ('id_autopay_max_usd', '10', 'Indonesia payout wallet: largest loan paid automatically (USD).'),
  ('id_autopay_daily_cap_usd', '100', 'Indonesia payout wallet: most paid automatically per Bangkok day (USD).'),
  ('id_payout_wallet_account_id', '', 'Indonesia payout wallet: Openfort backend account id (acc_…). Set by "Create payout wallet" in admin.'),
  ('id_payout_wallet_address', '', 'Indonesia payout wallet: its address on BNB Smart Chain. Top it up with USDC (BSC) from Binance TH.'),
  ('id_payout_low_alerted_at', '', 'Indonesia payout wallet: last "balance low" team alert (at most once per 6 h).'),
  ('id_payout_cap_alerted_day', '', 'Indonesia payout wallet: Bangkok day the "daily cap reached" alert was last sent.')
on conflict (key) do nothing;

-- id_manual_payouts now holds automatic payouts too.
alter table public.id_manual_payouts
  add column if not exists method text not null default 'manual' check (method in ('manual', 'auto')),
  add column if not exists openfort_tx_id text,
  add column if not exists paid_attempt_at timestamptz,
  add column if not exists error text;

alter table public.id_manual_payouts drop constraint if exists id_manual_payouts_status_check;
alter table public.id_manual_payouts add constraint id_manual_payouts_status_check
  check (status in ('waiting', 'paying', 'found', 'not_found', 'failed'));

alter table public.id_manual_payouts drop constraint if exists id_manual_payouts_found_by_check;
alter table public.id_manual_payouts add constraint id_manual_payouts_found_by_check
  check (found_by in ('scan', 'txid', 'auto'));

create index if not exists id_manual_payouts_auto_day_idx on public.id_manual_payouts (paid_attempt_at) where method = 'auto';

-- The claim. Everything that decides "may we send money for this loan now" happens here, in one
-- transaction under one advisory lock, so two runs (the 5-minute job and an admin's "Pay now") can
-- neither pay the same loan twice nor both squeeze under the daily cap.
--   p_max_usd / p_cap_usd: the per-loan max and the daily cap
--   p_day_start: start of today in Bangkok (the caller computes it)
-- Returns {ok:true, payout:<row>} or {ok:false, error:'<code>'}. The wallet balance is checked by the
-- caller before claiming (it needs BNB Chain).
create or replace function public.claim_id_auto_payout(
  p_loan_id uuid,
  p_lender_user_id uuid,
  p_max_usd numeric,
  p_cap_usd numeric,
  p_day_start timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan record;
  v_walt text;
  v_paid numeric;
  v_row public.id_manual_payouts;
begin
  perform pg_advisory_xact_lock(hashtext('id_auto_payout'));

  select id, borrower_user_id, loan_amount, loan_status, lender_user_id, funded_at, market
    into v_loan
    from public.loans where id = p_loan_id
    for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'loan_not_found'); end if;
  if v_loan.market is distinct from 'ID' then return jsonb_build_object('ok', false, 'error', 'not_indonesia_loan'); end if;
  if v_loan.loan_status <> 'Requested' or v_loan.lender_user_id is not null or v_loan.funded_at is not null then
    return jsonb_build_object('ok', false, 'error', 'loan_not_open');
  end if;
  if coalesce(v_loan.loan_amount, 0) <= 0 then return jsonb_build_object('ok', false, 'error', 'bad_amount'); end if;
  if v_loan.loan_amount > p_max_usd then return jsonb_build_object('ok', false, 'error', 'over_max'); end if;

  select walt_address into v_walt from public.users where id = v_loan.borrower_user_id;
  if v_walt is null or v_walt !~ '^0x[0-9a-fA-F]{40}$' then return jsonb_build_object('ok', false, 'error', 'no_walt_address'); end if;

  -- Every automatic attempt today counts, failed ones too (a failure can still have sent money).
  select coalesce(sum(amount), 0) into v_paid
    from public.id_manual_payouts
   where method = 'auto' and paid_attempt_at >= p_day_start;
  if v_paid + v_loan.loan_amount > p_cap_usd then
    return jsonb_build_object('ok', false, 'error', 'daily_cap_reached', 'paid_today', v_paid);
  end if;

  insert into public.id_manual_payouts (loan_id, borrower_user_id, walt_address, amount)
  values (v_loan.id, v_loan.borrower_user_id, lower(v_walt), v_loan.loan_amount)
  on conflict (loan_id) do nothing;

  -- Only a row nobody has touched: 'waiting', no "I sent it" tap, no tx. Anything else (an admin
  -- paying by hand, an earlier automatic attempt, a found transfer) is never claimed.
  update public.id_manual_payouts
     set status = 'paying',
         method = 'auto',
         paid_attempt_at = now(),
         lender_user_id = p_lender_user_id,
         walt_address = lower(v_walt),
         amount = v_loan.loan_amount,
         openfort_tx_id = null,
         error = null,
         updated_at = now()
   where loan_id = v_loan.id
     and status = 'waiting'
     and marked_sent_at is null
     and bsc_tx_hash is null
     and openfort_tx_id is null
  returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'already_claimed'); end if;

  return jsonb_build_object('ok', true, 'payout', to_jsonb(v_row), 'paid_today', v_paid);
end;
$$;

revoke all on function public.claim_id_auto_payout(uuid, uuid, numeric, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_id_auto_payout(uuid, uuid, numeric, numeric, timestamptz) to service_role;
