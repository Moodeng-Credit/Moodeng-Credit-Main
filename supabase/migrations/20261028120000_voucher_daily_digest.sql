-- Daily food-voucher check for the rewards Telegram group (voucher_alert_chat_id), 10:00 Bangkok:
--   1. earned, not claimed yet (same eligibility as admin_unclaimed_vouchers / get_my_rewards)
--   2. claimed, not sent yet (stuck: out of links, Bitrefill not ready)
--   3. sent, but no "I got it" yet (and who said "Didn't get it")
-- One row per person, with their Facebook name so the team can nudge them. Test accounts are left out.
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
          'name', coalesce(nullif(btrim(u.display_name), ''), u.username, 'Someone'),
          'username', u.username,
          'facebook', coalesce(u.facebook_name, u.facebook_contact),
          'messenger', u.messenger_verified_at is not null,
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

-- 10:00 Bangkok = 03:00 UTC, every day.
do $$
begin
  perform cron.unschedule('voucher-daily-digest');
exception
  when others then null;
end $$;

select cron.schedule(
  'voucher-daily-digest',
  '0 3 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/voucher-claim-telegram-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1)
    ),
    body := jsonb_build_object('event', 'digest'),
    timeout_milliseconds := 60000
  )
  $$
);
