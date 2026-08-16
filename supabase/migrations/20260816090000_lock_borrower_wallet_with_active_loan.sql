-- Server-side enforcement: a borrower cannot disconnect or swap their wallet while a loan they
-- took out is still outstanding.
--
-- Context: a borrower's wallet is the on-chain anchor their loan and repayments are tied to.
-- The client guard (AccountSettings.checkWalletChangeSafety) refuses the change/disconnect UI,
-- but the wallet lives in a plain `users` column writable through "Users can update own data",
-- so a direct PostgREST write (or any path that bypasses the UI) could still null/replace it.
-- This trigger closes that hole at the database, so every write path is covered.
--
-- Allowed (NOT blocked):
--   * first-time set                      — OLD.wallet_address IS NULL
--   * reconnecting the SAME address        — NEW.wallet_address = OLD.wallet_address
--   * any change once the loan is repaid   — no 'Lent' + not-'Paid' loan remains
--   * server/admin writes                  — current_user is not authenticated/anon
-- Blocked:
--   * clearing (disconnect) or swapping the wallet while a 'Lent', not-'Paid' loan exists.
--
-- The "active loan" predicate mirrors the client exactly:
--   loan_status = 'Lent' AND repayment_status <> 'Paid'
--
-- Pattern notes (kept consistent with enforce_user_privileged_columns_server_only,
-- migration 20260811020000):
--   * The trigger is SECURITY INVOKER so `current_user` resolves to the real caller
--     (authenticated/anon for client writes, something else for service_role/backend) — this is
--     what lets server-side code bypass the guard. A SECURITY DEFINER trigger would resolve
--     current_user to the owner and never fire.
--   * The cross-table read of `loans` is delegated to a small SECURITY DEFINER helper so it
--     cannot fail-open if a borrower's RLS ever stopped exposing their own loan rows. The helper
--     only returns a boolean and is granted to the client roles that run the trigger.

create or replace function public.borrower_has_active_loan(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.loans
    where borrower_user_id = p_user
      and loan_status = 'Lent'
      and repayment_status::text <> 'Paid'
  );
$$;

revoke all on function public.borrower_has_active_loan(uuid) from public;
grant execute on function public.borrower_has_active_loan(uuid) to authenticated, anon;

create or replace function public.lock_borrower_wallet_with_active_loan()
returns trigger as $$
begin
  -- Server-side / admin writes bypass — only client writes run as authenticated/anon.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Only borrowers, and only when the wallet IDENTITY actually changes (cleared or swapped).
  -- First-time set and reconnecting the same address are always allowed.
  if new.user_role = 'borrower'
     and old.wallet_address is not null
     and new.wallet_address is distinct from old.wallet_address
     and public.borrower_has_active_loan(new.id)
  then
    raise exception 'wallet is locked while you have an active loan: repay it before changing or disconnecting your wallet'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

drop trigger if exists trg_lock_borrower_wallet_with_active_loan on public.users;
create trigger trg_lock_borrower_wallet_with_active_loan
  before update on public.users
  for each row execute function public.lock_borrower_wallet_with_active_loan();
