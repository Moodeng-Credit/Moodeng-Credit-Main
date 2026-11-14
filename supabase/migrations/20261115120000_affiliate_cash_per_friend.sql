-- Affiliate program: $5 USDC per friend, replacing the "Pay zero interest" interest refund.
--
-- Once you've repaid a loan (held 24h or more, same rule as streak rewards), you're an affiliate:
-- each friend who signed up with your personal invite code (friend_referrals) and repays a loan
-- (held 24h+, not a test loan, not one you funded) earns you $5 USDC, once per friend. Friends who
-- signed up before you unlocked still count: they're paid the moment you repay.
--
-- Same table (interest_refunds) so the admin page and the Telegram card keep working; new rows are
-- kind = 'cash' with loan_id null. Old 'interest' rows stay as they were (the team pays them as before).

alter table public.interest_refunds add column if not exists kind text not null default 'interest';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'interest_refunds_kind') then
    alter table public.interest_refunds
      add constraint interest_refunds_kind check (kind in ('interest', 'cash'));
  end if;
end $$;

alter table public.interest_refunds drop constraint if exists interest_refunds_amount_positive;
alter table public.interest_refunds
  add constraint interest_refunds_amount_positive check (amount_usd > 0 and (kind = 'cash' or amount_usd <= interest_usd));

-- The affiliate gate and the friend test: a fully repaid loan held 24h or more.
create or replace function app_private.is_affiliate(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.loans l
    where l.borrower_user_id = p_user
      and app_private.is_fully_repaid_loan(l)
      and app_private.loan_counts_for_rewards(l)
  );
$$;

create or replace function app_private.queue_interest_refunds(p_inviter uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_queued integer := 0;
begin
  if p_inviter is null
     or exists (select 1 from app_private.voucher_blocked_users b where b.user_id = p_inviter)
     or not app_private.is_affiliate(p_inviter) then
    return 0;
  end if;

  insert into public.interest_refunds (user_id, friend_referral_id, loan_id, interest_usd, amount_usd, kind)
  select p_inviter, r.id, null, 0, 5, 'cash'
  from public.friend_referrals r
  where r.referrer_user_id = p_inviter
    and r.referred_user_id is not null
    and r.referred_user_id <> p_inviter
    and not exists (select 1 from public.interest_refunds ir where ir.friend_referral_id = r.id)
    and exists (
      select 1 from public.loans fl
      where fl.borrower_user_id = r.referred_user_id
        and fl.lender_user_id is distinct from p_inviter
        and app_private.is_fully_repaid_loan(fl)
        and app_private.loan_counts_for_rewards(fl)
    )
  order by r.created_at
  on conflict do nothing;

  get diagnostics v_queued = row_count;
  return v_queued;
end;
$$;

-- Borrower-facing: the /refer tracker. Old keys kept so an older app still parses.
create or replace function public.get_my_interest_refunds()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (select auth.uid() as id),
  friends as (
    select r.id, r.created_at,
      exists (
        select 1 from public.loans fl
        where fl.borrower_user_id = r.referred_user_id
          and fl.lender_user_id is distinct from r.referrer_user_id
          and app_private.is_fully_repaid_loan(fl)
          and app_private.loan_counts_for_rewards(fl)
      ) as repaid
    from public.friend_referrals r, me
    where r.referrer_user_id = me.id
  )
  select jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'joinedAt', f.created_at,
        'repaid', f.repaid,
        'refundUsd', ir.amount_usd,
        'refundStatus', ir.status,
        'kind', ir.kind,
        'sentAt', ir.sent_at,
        'txHash', ir.tx_hash
      ) order by f.created_at desc)
      from friends f
      left join public.interest_refunds ir on ir.friend_referral_id = f.id
    ), '[]'::jsonb),
    'totalRefundedUsd', coalesce((select sum(amount_usd) from public.interest_refunds, me where user_id = me.id and status = 'sent'), 0),
    'totalEarnedUsd', coalesce((select sum(amount_usd) from public.interest_refunds, me where user_id = me.id and status = 'sent'), 0),
    'owedUsd', coalesce((select sum(amount_usd) from public.interest_refunds, me where user_id = me.id and status = 'pending'), 0),
    'isAffiliate', coalesce((select app_private.is_affiliate(me.id) from me), false),
    'rewardUsd', 5
  );
$$;

revoke all on function app_private.is_affiliate(uuid) from public;
revoke all on function public.get_my_interest_refunds() from public;
revoke all on function app_private.queue_interest_refunds(uuid) from public;
grant execute on function public.get_my_interest_refunds() to authenticated;
