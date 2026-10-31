-- A borrower with a past-due, unpaid loan cannot claim vouchers until that loan is repaid.
-- "Past due" is the same deadline the app and milestones use (app_private.loan_past_due_at).
-- The block lifts as soon as the loan is marked Paid. Vouchers already claimed are not affected.

create or replace function app_private.has_overdue_loan(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.loans as l
    where l.borrower_user_id = p_user_id
      and l.loan_status = 'Lent'
      and coalesce(l.repayment_status::text, 'Unpaid') <> 'Paid'
      and l.refunded_at is null
      and now() >= app_private.loan_past_due_at(l)
  );
$$;

revoke all on function app_private.has_overdue_loan(uuid) from public;

-- For the claim popup: show "repay first" before the borrower fills in the form.
create or replace function public.my_vouchers_blocked_by_overdue()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and app_private.has_overdue_loan(auth.uid());
$$;

revoke all on function public.my_vouchers_blocked_by_overdue() from public;
grant execute on function public.my_vouchers_blocked_by_overdue() to authenticated;

create or replace function public.submit_voucher_claim(p_reward text, p_friend_referral_id uuid, p_full_name text, p_mobile text, p_email text default null::text, p_brand text default 'food'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric;
  v_eligible boolean;
  v_tier record;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if app_private.has_overdue_loan(v_user_id) then
    raise exception 'overdue loan: repay your loan to claim vouchers' using errcode = '42501';
  end if;

  if p_reward = 'first_on_time_repayment' then
    v_amount := 50;
    v_eligible := p_friend_referral_id is null and app_private.has_on_time_repayment(v_user_id);
  elsif p_reward = 'referral_invitee' then
    v_amount := 100;
    v_eligible := exists (
      select 1 from public.friend_referrals r
      where r.id = p_friend_referral_id and r.referred_user_id = v_user_id
        and app_private.has_on_time_repayment(v_user_id, r.referrer_user_id)
    );
  elsif p_reward = 'referral_inviter' then
    v_amount := 100;
    v_eligible := exists (
      select 1 from public.friend_referrals r
      where r.id = p_friend_referral_id and r.referrer_user_id = v_user_id
        and app_private.has_on_time_repayment(r.referred_user_id, r.referrer_user_id)
    );
  elsif p_reward in ('tier_rising', 'tier_prime', 'tier_apex') then
    select * into v_tier from app_private.tier_voucher(p_reward);
    v_amount := v_tier.amount_php;
    v_eligible := p_friend_referral_id is null and app_private.pandesal_total(v_user_id) >= v_tier.min_pandesal;
  else
    raise exception 'unknown reward %', p_reward using errcode = '22023';
  end if;

  if not v_eligible then
    raise exception 'not eligible for this voucher' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'email required: the voucher is emailed' using errcode = '22023';
  end if;
  if coalesce(p_brand, 'food') not in ('food', 'grabmart') then
    raise exception 'unknown brand %', p_brand using errcode = '22023';
  end if;
  if p_brand = 'grabmart' and v_amount < 100 then
    raise exception 'grabmart needs 100: GrabMart vouchers start at PHP 100' using errcode = '22023';
  end if;

  insert into public.voucher_claims (user_id, reward, friend_referral_id, amount_php, full_name, mobile, email, brand)
  values (v_user_id, p_reward, p_friend_referral_id, v_amount, trim(p_full_name), trim(p_mobile), nullif(trim(coalesce(p_email, '')), ''), coalesce(p_brand, 'food'))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'voucher already claimed' using errcode = '23505';
end;
$function$;
