-- Indonesia track: funding a loan by hand from Binance TH straight to the borrower's Walt address
-- (USDC on BNB Smart Chain), and the app confirming it by itself on-chain.
--
--   Admin → Requests → an Indonesian request → "Paid to Walt" card: copy the Walt address + exact
--   amount, send USDC on BSC from Binance TH, tap "I sent it". The 5-minute job (video-call-reminders
--   → _shared/idManualFunding.ts) looks on BNB Chain for a USDC transfer of exactly that amount to
--   that address after the request was posted. Found → the loan is funded (funding_method
--   'walt_manual', lender = the admin who sent it, repayments go to that admin's Base wallet), the
--   team gets a line, and the bot tells the borrower in Bahasa. Not found after 30 min → one ping.
--
--   Nothing is ever matched without a tap (or a pasted TxID): exchange hot wallets are shared by
--   millions, so a borrower withdrawing $5 into their own Walt must never look "funded".

alter table public.loans drop constraint if exists loans_funding_method_check;
alter table public.loans add constraint loans_funding_method_check
  check (funding_method = any (array['direct', 'smart_contract', 'credit_line', 'walt_manual']));

create table if not exists public.id_manual_payouts (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null unique references public.loans(id) on delete cascade,
  borrower_user_id uuid not null references public.users(id) on delete cascade,
  walt_address text not null,
  amount numeric not null,
  -- who will be the lender of record (repayments go to their users.wallet_address on Base)
  lender_user_id uuid references public.users(id),
  marked_sent_at timestamptz,                 -- admin tapped "I sent it"
  status text not null default 'waiting' check (status in ('waiting', 'found', 'not_found')),
  bsc_tx_hash text unique,                    -- the BNB Chain transfer that paid it (never reused)
  from_address text,
  block_number bigint,
  found_at timestamptz,
  found_by text check (found_by in ('scan', 'txid')),
  not_found_alerted_at timestamptz,
  scanned_to_block bigint,                    -- the scan resumes from here (BNB Chain block number)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists id_manual_payouts_open_idx on public.id_manual_payouts (status) where status <> 'found';

alter table public.id_manual_payouts enable row level security;
drop policy if exists id_manual_payouts_admin_read on public.id_manual_payouts;
create policy id_manual_payouts_admin_read on public.id_manual_payouts for select to authenticated
  using (app_private.is_moodeng_admin());
-- Writes only through admin-fund-loan / the cron job (service role).

insert into public.telegram_bot_settings (key, value, description) values
  ('id_payout_lender_user_id', '2371a419-4344-4f28-b580-19933e3d663f', 'Indonesia manual payouts: lender of record when a payout is found without anyone tapping "I sent it" (George''s direct-lend account, the BitRepo facility lender).')
on conflict (key) do nothing;

-- BitRepo credit line: loans under $15 are skipped as tests — except Indonesia-track loans, which
-- are $5/$10 by design. (Same function as 20261013180000, one condition added.)
create or replace function app_private.link_credit_facility_loan()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
   IF NEW.loan_status IS DISTINCT FROM 'Lent' OR NEW.funded_at IS NULL OR NEW.lender_user_id IS NULL OR coalesce(NEW.is_test, false)
      OR (coalesce(NEW.loan_amount, 0) < 15 AND NEW.market IS DISTINCT FROM 'ID') THEN
      RETURN NULL;
   END IF;
   IF TG_OP = 'UPDATE' AND OLD.loan_status = 'Lent' AND OLD.funded_at IS NOT NULL AND OLD.lender_user_id IS NOT DISTINCT FROM NEW.lender_user_id THEN
      RETURN NULL;
   END IF;
   BEGIN
      INSERT INTO public.credit_facility_loans (facility_id, loan_id, rationale)
      SELECT f.id, NEW.id, app_private.draft_facility_rationale(NEW.id)
        FROM public.credit_facilities f
       WHERE f.lender_user_id = NEW.lender_user_id
         AND (NEW.funded_at AT TIME ZONE 'Asia/Manila')::date >= f.start_date
       ORDER BY f.start_date DESC
       LIMIT 1
      ON CONFLICT DO NOTHING;
   EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'link_credit_facility_loan failed for %: %', NEW.id, SQLERRM;
   END;
   RETURN NULL;
END;
$function$;
