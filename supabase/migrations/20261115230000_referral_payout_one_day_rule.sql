-- A referral code owner is owed only when the person they referred repays a loan they held for at
-- least a day — the same rule as the repay rewards (#1489). A loan repaid within 24 hours of
-- funding doesn't count. When the friend later repays a loan held a day or more, the payout row is
-- created then (one per code + referred user, as before).
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
     or new.funded_at is null
     or now() - new.funded_at < interval '24 hours'
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

-- The one unpaid payout that came from a loan repaid within a day (MAHJID, 53 minutes, 2026-11-13).
delete from public.referral_code_payouts p
where p.status = 'unpaid'
  and exists (
    select 1 from public.loans l
    where l.borrower_user_id = p.referred_user_id
      and l.repayment_status = 'Paid'
      and l.funded_at < p.created_at
      and p.created_at - l.funded_at < interval '24 hours'
      and not exists (
        select 1 from public.loans l2
        where l2.borrower_user_id = p.referred_user_id
          and l2.repayment_status = 'Paid'
          and l2.funded_at <= p.created_at - interval '24 hours'
      )
  );
