-- Feed the wallet-usage ledger from loans, not only from profile saves.
--
-- Context: `wallet_usage_log` (20260629000000) drives the `shared_wallet` self-lending
-- signal in `admin_get_detection_overview` (20260629050000). Until now it was populated
-- ONLY by a trigger on `users.wallet_address` — i.e. it saw a wallet only when it was saved
-- to a profile. That was fine while funding/repaying REQUIRED a wagmi connection (which saves
-- the wallet). With Base Pay, a lender can fund a loan without ever connecting through wagmi,
-- so their paying wallet (`loans.lender_wallet`, recorded from the Base Pay `sender`) never
-- reaches `users.wallet_address` and never entered this ledger — blinding the cross-account
-- shared-wallet detection to Base-Pay-only accounts.
--
-- Fix: also log the wallets that actually touch a loan, on an ongoing basis (the original
-- migration only backfilled loan wallets once). Loans are the source of truth for who
-- transacted, so this is strictly more complete than relying on profile saves — before Base
-- Pay too. `same_wallet_on_loan` was never affected (it reads the loan row directly).

create or replace function app_private.log_wallet_usage_from_loan()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Lender side (set at funding time; on Base Pay this is the confirmed payer's address).
  if new.lender_user_id is not null and new.lender_wallet is not null and btrim(new.lender_wallet) <> '' then
    insert into public.wallet_usage_log (user_id, wallet_address, role)
    values (new.lender_user_id, lower(btrim(new.lender_wallet)), 'lender')
    on conflict (user_id, wallet_address)
    do update set last_seen_at = now(),
                  use_count    = wallet_usage_log.use_count + 1,
                  role         = excluded.role;
  end if;

  -- Borrower side (set at request time — the locked Base wallet loans are sent to).
  if new.borrower_user_id is not null and new.borrower_wallet is not null and btrim(new.borrower_wallet) <> '' then
    insert into public.wallet_usage_log (user_id, wallet_address, role)
    values (new.borrower_user_id, lower(btrim(new.borrower_wallet)), 'borrower')
    on conflict (user_id, wallet_address)
    do update set last_seen_at = now(),
                  use_count    = wallet_usage_log.use_count + 1,
                  role         = excluded.role;
  end if;

  return new;
end;
$$;

-- Fire only when the wallet columns are actually touched, so ordinary status/amount updates
-- don't churn use_count. INSERT covers the borrower wallet at request time; the `update of
-- lender_wallet` covers funding (including Base Pay, whose sender we write to lender_wallet).
drop trigger if exists log_wallet_usage_on_loans on public.loans;
create trigger log_wallet_usage_on_loans
  after insert or update of lender_wallet, borrower_wallet on public.loans
  for each row execute function app_private.log_wallet_usage_from_loan();

-- One-time catch-up for any loan wallets that landed while only the profile trigger was live
-- (e.g. Base Pay funds since the migration went out). Mirrors the original backfill.
insert into public.wallet_usage_log (user_id, wallet_address, role)
select l.lender_user_id, lower(btrim(l.lender_wallet)), 'lender'
from public.loans l
where l.lender_user_id is not null and l.lender_wallet is not null and btrim(l.lender_wallet) <> ''
on conflict (user_id, wallet_address) do nothing;

insert into public.wallet_usage_log (user_id, wallet_address, role)
select l.borrower_user_id, lower(btrim(l.borrower_wallet)), 'borrower'
from public.loans l
where l.borrower_user_id is not null and l.borrower_wallet is not null and btrim(l.borrower_wallet) <> ''
on conflict (user_id, wallet_address) do nothing;
