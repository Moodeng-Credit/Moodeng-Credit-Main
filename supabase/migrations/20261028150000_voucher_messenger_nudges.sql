-- Messenger reward nudges (voucher-claim-telegram-notification, event 'digest'): the daily run tells
-- people on Messenger who earned a reward but haven't claimed it, or got it but never tapped "I got
-- it". One row per person and kind remembers the last nudge, so each new amount is nudged once.
create table if not exists public.voucher_messenger_nudges (
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('unclaimed', 'no_answer')),
  amount_php numeric not null,
  nudged_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.voucher_messenger_nudges enable row level security;
revoke all on public.voucher_messenger_nudges from public, anon, authenticated;

-- The digest now also carries each person's id and SendPulse contact, for the nudges and the 💬
-- buttons. Otherwise unchanged from 20261028120000_voucher_daily_digest.sql.
create or replace function public.voucher_daily_digest()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
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
  ),
  unclaimed as (
    select e.user_id, sum(e.amount_php) as amount_php, count(*) as vouchers
    from eligible e
    where not exists (
      select 1 from public.voucher_claims c
      where c.user_id = e.user_id and c.reward = e.reward
        and c.friend_referral_id is not distinct from e.friend_referral_id and c.status <> 'rejected'
    )
    group by e.user_id
  ),
  claims as (
    select c.user_id,
      case
        when c.status = 'pending' then 'pending'
        when c.received_at is null and c.receipt_issue_at is not null then 'not_arrived'
        else 'no_answer'
      end as bucket,
      c.amount_php,
      coalesce(c.sent_at, c.created_at) as since
    from public.voucher_claims c
    where c.status = 'pending' or (c.status = 'sent' and c.received_at is null)
  ),
  people as (
    select 'unclaimed' as bucket, user_id, amount_php, vouchers, null::timestamptz as since from unclaimed
    union all
    select bucket, user_id, sum(amount_php), count(*), min(since) from claims group by bucket, user_id
  )
  select jsonb_build_object(
    'unclaimed', '[]'::jsonb, 'pending', '[]'::jsonb, 'not_arrived', '[]'::jsonb, 'no_answer', '[]'::jsonb
  ) || coalesce((
    select jsonb_object_agg(bucket, rows)
    from (
      select p.bucket, jsonb_agg(jsonb_build_object(
          'userId', u.id,
          'messengerContactId', u.messenger_psid,
          'name', coalesce(nullif(btrim(u.display_name), ''), u.username, 'Someone'),
          'username', u.username,
          'facebook', coalesce(u.facebook_name, u.facebook_contact),
          'messenger', u.messenger_verified_at is not null or u.messenger_psid is not null,
          'amountPhp', p.amount_php,
          'vouchers', p.vouchers,
          'days', case when p.since is null then null else floor(extract(epoch from now() - p.since) / 86400)::int end
        ) order by p.since nulls last, p.amount_php desc) as rows
      from people p
      join public.users u on u.id = p.user_id
      where not coalesce(u.is_test, false)
      group by p.bucket
    ) grouped
  ), '{}'::jsonb);
$$;

revoke all on function public.voucher_daily_digest() from public, anon, authenticated;
grant execute on function public.voucher_daily_digest() to service_role;
