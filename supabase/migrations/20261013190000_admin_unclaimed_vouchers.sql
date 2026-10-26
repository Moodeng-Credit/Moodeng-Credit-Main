-- Admin "GrabFood vouchers" tab: borrowers who have earned a voucher but not claimed it yet, so the
-- team can see the full amount we could owe and nudge people to claim. Same eligibility rules as
-- public.get_my_rewards (one row per earned voucher without a live claim). Admin-gated, read-only.
create or replace function public.admin_unclaimed_vouchers()
returns table (
  user_id uuid,
  username text,
  display_name text,
  email text,
  reward text,
  friend_referral_id uuid,
  amount_php numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  with eligible as (
    select u.id as user_id, 'first_on_time_repayment'::text as reward, null::uuid as friend_referral_id, 50::numeric as amount_php
    from public.users u
    where app_private.has_on_time_repayment(u.id)
    union all
    select r.referred_user_id, 'referral_invitee', r.id, 100::numeric
    from public.friend_referrals r
    where app_private.has_on_time_repayment(r.referred_user_id, r.referrer_user_id)
    union all
    select r.referrer_user_id, 'referral_inviter', r.id, 100::numeric
    from public.friend_referrals r
    where app_private.has_on_time_repayment(r.referred_user_id, r.referrer_user_id)
    union all
    select u.id, t.reward, null::uuid, (app_private.tier_voucher(t.reward)).amount_php
    from public.users u
    cross join unnest(array['tier_rising', 'tier_prime', 'tier_apex']) as t(reward)
    where app_private.pandesal_total(u.id) >= (app_private.tier_voucher(t.reward)).min_pandesal
  )
  select e.user_id, u.username, u.display_name, u.email, e.reward, e.friend_referral_id, e.amount_php
  from eligible e
  join public.users u on u.id = e.user_id
  where not coalesce(u.is_test, false)
    and not exists (
      select 1 from public.voucher_claims c
      where c.user_id = e.user_id
        and c.reward = e.reward
        and c.friend_referral_id is not distinct from e.friend_referral_id
        and c.status <> 'rejected'
    )
  order by u.username nulls last, e.reward;
end;
$$;

revoke all on function public.admin_unclaimed_vouchers() from public, anon;
grant execute on function public.admin_unclaimed_vouchers() to authenticated;
