-- A code owner is owed only once the person they referred takes a loan AND repays it — not at
-- redemption. Payout row is created when the referred borrower's loan is fully repaid (same "repaid"
-- test as app_private.has_on_time_repayment, minus the on-time rule). A loan the owner funded
-- themselves doesn't count. One payout per (code, referred user), so later repayments don't re-alert.
drop trigger if exists create_referral_code_payout on public.users;
drop function if exists private.create_referral_code_payout();

create or replace function private.create_referral_code_payout_on_repayment()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  rc public.referral_codes%rowtype;
begin
  if new.repayment_status is distinct from 'Paid'
     or new.refunded_at is not null
     or coalesce(new.is_test, false)
     or not (case
          when coalesce(new.total_repayment_amount, 0) > 0 then coalesce(new.repaid_amount, 0) >= new.total_repayment_amount
          else coalesce(new.repaid_amount, 0) > 0
        end) then
    return new;
  end if;

  select r.* into rc
  from public.users u
  join public.referral_codes r on r.id = u.redeemed_referral_code_id
  where u.id = new.borrower_user_id;

  if not found
     or rc.owner_user_id is null
     or rc.owner_user_id = new.borrower_user_id
     or rc.owner_user_id is not distinct from new.lender_user_id then
    return new;
  end if;

  insert into public.referral_code_payouts (referral_code_id, code, owner_user_id, referred_user_id)
  values (rc.id, rc.code, rc.owner_user_id, new.borrower_user_id)
  on conflict (referral_code_id, referred_user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_referral_code_payout_on_repayment() from public, anon, authenticated;

drop trigger if exists create_referral_code_payout_on_repayment on public.loans;
create trigger create_referral_code_payout_on_repayment
  after insert or update of repayment_status, repaid_amount, refunded_at on public.loans
  for each row
  execute function private.create_referral_code_payout_on_repayment();
