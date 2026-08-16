-- Admin loan refunds.
--
-- Lets an active admin repay a LENDER out of the admin's own wallet for an outstanding loan,
-- record it as a first-class refund, cancel the loan (so it is no longer due), and ban +
-- KYC-blacklist the BORROWER. The actual USDC transfer and every money-column write happen
-- ONLY inside the `admin-refund-loan` Edge Function (service role), which independently verifies
-- the on-chain transfer to the lender first — the same proof-of-payment gate confirm-loan-payment
-- uses. This migration moves no money and mutates no existing loan; it only adds tables/columns
-- and admin-scoped RLS.
--
-- WHY a refunded loan is set repayment_status = 'Paid' by the edge fn (not a new enum value):
--   The `repayment_status` "is it still owed?" checks are spread across ~30 files and split between
--   two idioms — `in ('Unpaid','Partial')` (due/overdue/coming-due) AND `!= 'Paid'` (borrower
--   "amount owed" surfaces). A brand-new 'Refunded' value would be excluded by the first idiom but
--   INCLUDED by the second, so a cancelled loan would still read as owed on some borrower screens.
--   Setting 'Paid' makes every existing check treat it as settled with zero edits, guaranteeing the
--   loan can never resurface as due. `refunded_at` below is the honest marker that this was an admin
--   refund, NOT a borrower repayment (UI keys its "Refunded" label off it; reporting can net it out).

-- 1) Refund provenance columns on loans.
alter table public.loans
  add column if not exists refunded_at   timestamptz,
  add column if not exists refund_reason text,
  add column if not exists refunded_by   uuid references public.users(id),
  add column if not exists refund_hash   text;

-- 2) Immutable refund ledger — one row per refund.
create table if not exists public.loan_refunds (
  id               uuid primary key default gen_random_uuid(),
  loan_id          uuid not null references public.loans(id),
  lender_user_id   uuid references public.users(id),
  borrower_user_id uuid references public.users(id),
  lender_wallet    text,
  amount           numeric not null,
  coin             text not null default 'USDC',
  reason           text not null,
  tx_hash          text not null,
  method           text not null check (method in ('wallet', 'base')),
  refunded_by      uuid references public.users(id),
  created_at       timestamptz not null default now()
);
create index if not exists loan_refunds_loan_id_idx on public.loan_refunds (loan_id);
create index if not exists loan_refunds_lender_idx on public.loan_refunds (lender_user_id);

-- 3) Internal KYC blacklist — bars a user from KYC / re-registration. `didit_pushed` records whether
--    the best-effort push to the external DIDIT provider blocklist succeeded (see the edge fn).
create table if not exists public.kyc_blacklist (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.users(id) on delete set null,
  wallet_address text,
  email          text,
  reason         text not null,
  source         text not null default 'admin_refund',
  didit_pushed   boolean not null default false,
  didit_response jsonb,
  created_by     uuid references public.users(id),
  created_at     timestamptz not null default now(),
  unique (user_id)
);
create index if not exists kyc_blacklist_wallet_idx on public.kyc_blacklist (lower(wallet_address));
create index if not exists kyc_blacklist_email_idx on public.kyc_blacklist (lower(email));

-- 4) Guard the refund columns the same way loan money columns are guarded: only a verified
--    server-side path (service role) may write them. This is a SEPARATE, additive trigger — it
--    deliberately does NOT touch enforce_loan_money_columns_service_role_only(), whose deployed body
--    is edited from several places and must be read from the live DB before any replace (see
--    20260811020000_restore_full_privileged_column_guard.sql for that lesson). MUST be SECURITY
--    INVOKER so current_user reflects the real caller (a DEFINER fn would resolve to the owner and
--    never fire).
create or replace function enforce_loan_refund_columns_service_role_only()
returns trigger as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.refunded_at is distinct from old.refunded_at
     or new.refund_reason is distinct from old.refund_reason
     or new.refunded_by is distinct from old.refunded_by
     or new.refund_hash is distinct from old.refund_hash
  then
    raise exception 'loans: refund columns can only be written by a verified server-side refund';
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

drop trigger if exists trg_enforce_loan_refund_columns on public.loans;
create trigger trg_enforce_loan_refund_columns
  before update on public.loans
  for each row execute function enforce_loan_refund_columns_service_role_only();

-- 5) RLS — admin-only management (mirrors the admin_* tables); a lender may read their own refunds.
alter table public.loan_refunds enable row level security;
alter table public.kyc_blacklist enable row level security;

drop policy if exists "admins manage loan refunds" on public.loan_refunds;
create policy "admins manage loan refunds" on public.loan_refunds
  for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "lenders read own refunds" on public.loan_refunds;
create policy "lenders read own refunds" on public.loan_refunds
  for select to authenticated using (auth.uid() is not null and lender_user_id = auth.uid());

drop policy if exists "admins manage kyc blacklist" on public.kyc_blacklist;
create policy "admins manage kyc blacklist" on public.kyc_blacklist
  for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());
