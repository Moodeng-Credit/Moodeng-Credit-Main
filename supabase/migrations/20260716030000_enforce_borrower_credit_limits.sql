-- Enforce borrower credit limits in the database, not just the browser.
--
-- Background: a borrower carried $110 of live debt ($60 Lent+Unpaid, then a $50
-- request funded on top) against a $60 limit. The RequestBoard UI has summed
-- outstanding loans against the limit since May 2026, but nothing server-side
-- ever did — the INSERT policy only checks ownership + the repost cooldown, so
-- a stale client or a direct PostgREST insert sails past the limit.
--
-- This trigger makes the client-side gate authoritative:
--   1. New client-created loans must start as a clean 'Requested' row (the
--      money-lock trigger trg_enforce_loan_money_columns is UPDATE-only, so
--      without this a client could INSERT a loan pre-marked Lent/Paid and
--      forge repayment history — same class as the John disclosure).
--   2. sum(outstanding) + new amount must fit inside the borrower's effective
--      credit limit. Outstanding mirrors src/lib/borrowerCreditUsage.ts:
--      live Requested rows (< 7 days old) + Lent rows not fully Paid.
--   3. The active-loan count cap (users.mal) is enforced with the same
--      predicate as getBorrowerActiveLoanCount.
--
-- service_role / postgres paths (edge functions, admin tooling) are exempt,
-- matching the convention in enforce_loan_money_columns_service_role_only().

create or replace function public.enforce_borrower_credit_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_role text;
  v_cs integer;
  v_mal integer;
  v_verified boolean;
  v_effective_limit numeric;
  v_outstanding numeric;
  v_active_count integer;
begin
  -- Server-side writers (edge functions, admin) are trusted; only gate clients.
  -- NOTE: this function is SECURITY DEFINER (it must read/lock users past RLS),
  -- which makes current_user report the function owner — so the caller must be
  -- identified from the request JWT role claim, a session GUC set by PostgREST
  -- that clients cannot override. Edge functions carry 'service_role'; direct
  -- admin connections carry no claims at all.
  v_role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_user::text
  );
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;

  -- (1) Clients may only create pristine loan requests. Defaults already produce
  -- exactly this shape (loanSlice.ts createLoan sends none of these columns), so
  -- legit inserts are unaffected; only forged payloads trip it.
  if new.loan_status is distinct from 'Requested'::loan_status
     or new.repayment_status is distinct from 'Unpaid'::repayment_status
     or coalesce(new.repaid_amount, 0) <> 0
     or new.funded_at is not null
     or new.repaid_at is not null
     or new.lender_user_id is not null
     or new.lender_wallet is not null
     or coalesce(new.hash, '{}'::text[]) <> '{}'::text[]
     or new.onchain_loan_id is not null
     or new.onchain_request_id is not null
     or new.is_sellable
     or new.listing_price is not null
     or new.listing_tx_hash is not null
     or new.loan_note_owner_wallet is not null
     or new.interest_returned_at is not null
     or new.interest_return_hash is not null
  then
    raise exception 'loans: new loans must be created as a plain Requested row; funding and repayment are set server-side';
  end if;

  if new.borrower_user_id is null then
    raise exception 'loans: borrower_user_id is required';
  end if;

  if new.loan_amount is null or new.loan_amount <= 0 then
    raise exception 'loans: loan_amount must be positive';
  end if;

  -- Lock the borrower row so two concurrent requests serialize instead of both
  -- reading the same outstanding total and both squeezing under the limit.
  select u.cs, u.mal, (u.is_world_id::text = 'ACTIVE' or u.is_didit = 'ACTIVE')
    into v_cs, v_mal, v_verified
  from public.users u
  where u.id = new.borrower_user_id
  for update;

  if not found then
    raise exception 'loans: borrower not found';
  end if;

  if not coalesce(v_verified, false) then
    raise exception 'loans: borrower must be verified before requesting a loan';
  end if;

  -- Mirrors getEffectiveCreditLimit (creditLeveling.ts): clamp cs into
  -- [STARTING_CREDIT_LIMIT=15, MAX_CREDIT_LIMIT=140]. Referral boosts are
  -- already baked into cs by redeem_referral_code().
  v_effective_limit := least(greatest(coalesce(v_cs, 0), 15), 140);

  -- Mirrors isLoanUsingBorrowerCredit (borrowerCreditUsage.ts): live requests
  -- (< REQUEST_EXPIRATION_DAYS = 7 days old) plus funded-but-not-fully-repaid.
  select coalesce(sum(l.loan_amount), 0), count(*)
    into v_outstanding, v_active_count
  from public.loans l
  where l.borrower_user_id = new.borrower_user_id
    and (
      (l.loan_status = 'Requested'::loan_status
         and l.created_at > now() - interval '7 days')
      or (l.loan_status = 'Lent'::loan_status
         and l.repayment_status is distinct from 'Paid'::repayment_status)
    );

  if coalesce(v_mal, 0) > 0 and v_active_count >= v_mal then
    raise exception 'loans: active loan limit reached (% of % loans in use)', v_active_count, v_mal;
  end if;

  if v_outstanding + new.loan_amount > v_effective_limit then
    raise exception 'loans: request exceeds available credit ($% requested, $% already in use, $% limit)',
      new.loan_amount, v_outstanding, v_effective_limit;
  end if;

  return new;
end;
$$;

-- Trigger functions can't be invoked directly, but keep the surface closed anyway.
revoke all on function public.enforce_borrower_credit_limits() from public, anon, authenticated;

drop trigger if exists trg_enforce_borrower_credit_limits on public.loans;
create trigger trg_enforce_borrower_credit_limits
  before insert on public.loans
  for each row
  execute function public.enforce_borrower_credit_limits();
