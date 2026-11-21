-- Food vouchers now follow the on-time repayment streak, one reward at a time:
--   1st on-time repayment  → ₱50  (first_on_time_repayment, unchanged)
--   3 on time in a row     → ₱50  (streak_3, new)
--   5 on time in a row     → ₱50  (streak_5, new)
--   Prime / Apex           → ₱100 / ₱150 (unchanged)
-- Rules:
--   * A loan repaid less than 24 hours after it was funded counts for nothing: no voucher, no streak
--     step (it does not break a streak either). Stops borrow-and-repay-within-the-hour.
--   * A late repayment resets the streak. So does an overdue open loan, until it is repaid.
--   * The Rising voucher (60 Pandesal, which one loan already gives) is retired. Anyone who reached
--     60 before this migration can still claim it.
--   * The referral food vouchers were retired on 2026-11-01 (interest refunds replaced them) but the
--     daily digest, the Messenger nudge and the admin list still counted them. They no longer do.
-- Every voucher rule now lives in app_private.voucher_eligible(); the four voucher functions call it.

alter table public.voucher_claims drop constraint if exists voucher_claims_reward;
alter table public.voucher_claims add constraint voucher_claims_reward check (
  reward = any (array['first_on_time_repayment', 'referral_inviter', 'referral_invitee',
                      'tier_rising', 'tier_prime', 'tier_apex', 'streak_3', 'streak_5'])
);

create unique index if not exists voucher_claims_streak_once
  on public.voucher_claims (user_id, reward)
  where reward like 'streak\_%' and status <> 'rejected';

-- A repaid loan only counts once it was held for a day.
create or replace function app_private.loan_counts_for_rewards(p_loan public.loans)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select coalesce(p_loan.repaid_at, p_loan.updated_at) - coalesce(p_loan.funded_at, p_loan.created_at) >= interval '24 hours';
$function$;

create or replace function app_private.has_on_time_repayment(p_user_id uuid, p_exclude_lender uuid default null::uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select not exists (select 1 from app_private.voucher_blocked_users b where b.user_id = p_user_id)
  and exists (
    select 1
    from public.loans l
    where l.borrower_user_id = p_user_id
      and l.repayment_status = 'Paid'
      and l.refunded_at is null
      and not coalesce(l.is_test, false)
      and (p_exclude_lender is null or l.lender_user_id is distinct from p_exclude_lender)
      and case
            when coalesce(l.total_repayment_amount, 0) > 0 then coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
            else coalesce(l.repaid_amount, 0) > 0
          end
      and coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l)
      and app_private.loan_counts_for_rewards(l)
  );
$function$;

-- current_streak: on-time repayments in a row right now. best_streak: the longest run ever (a streak
-- voucher, once earned, is not lost by a later late payment).
create or replace function app_private.repay_streak(p_user_id uuid, out current_streak integer, out best_streak integer)
returns record
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with paid as (
    select coalesce(l.repaid_at, l.updated_at) as paid_at,
      coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l) as on_time
    from public.loans l
    where l.borrower_user_id = p_user_id
      and l.repayment_status = 'Paid'
      and l.refunded_at is null
      and not coalesce(l.is_test, false)
      and case
            when coalesce(l.total_repayment_amount, 0) > 0 then coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
            else coalesce(l.repaid_amount, 0) > 0
          end
      -- A late loan always counts (it resets); an on-time one only when held for a day.
      and (coalesce(l.repaid_at, l.updated_at) >= app_private.loan_past_due_at(l) or app_private.loan_counts_for_rewards(l))
      and not exists (select 1 from app_private.voucher_blocked_users b where b.user_id = p_user_id)
  ),
  runs as (
    select on_time, sum(case when on_time then 0 else 1 end) over (order by paid_at) as run from paid
  ),
  sized as (
    select run, count(*) filter (where on_time) as size from runs group by run
  )
  select
    case when app_private.has_overdue_loan(p_user_id) then 0
         else coalesce((select size from sized order by run desc limit 1), 0) end::integer,
    coalesce((select max(size) from sized), 0)::integer;
$function$;

revoke all on function app_private.repay_streak(uuid) from public;

create or replace function app_private.streak_voucher(p_reward text, out min_streak integer, out amount_php numeric)
returns record
language sql
immutable
set search_path to ''
as $function$
  select v.min_streak, v.amount_php
  from (values ('streak_3', 3, 50::numeric), ('streak_5', 5, 50)) as v(reward, min_streak, amount_php)
  where v.reward = p_reward;
$function$;

-- Rising voucher: only for people who had 60 Pandesal before the streak rewards replaced it.
create or replace function app_private.reached_rising_before_streaks(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((
    select sum(e.delta) from public.trust_point_events e
    where e.user_id = p_user_id and e.created_at < timestamptz '2026-11-14 17:00:00+00'
  ), 0) / 1000000.0 >= 60;
$function$;

revoke all on function app_private.reached_rising_before_streaks(uuid) from public;

-- The vouchers a person can claim on their own (referral vouchers are retired).
create or replace function app_private.voucher_rewards()
returns text[]
language sql
immutable
set search_path to ''
as $function$
  select array['first_on_time_repayment', 'streak_3', 'streak_5', 'tier_rising', 'tier_prime', 'tier_apex'];
$function$;

create or replace function app_private.voucher_amount(p_reward text)
returns numeric
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_reward = 'first_on_time_repayment' then 50::numeric
    when p_reward like 'streak\_%' then (app_private.streak_voucher(p_reward)).amount_php
    when p_reward like 'tier\_%' then (app_private.tier_voucher(p_reward)).amount_php
  end;
$function$;

create or replace function app_private.voucher_eligible(p_user_id uuid, p_reward text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when p_reward = 'first_on_time_repayment' then app_private.has_on_time_repayment(p_user_id)
    when p_reward like 'streak\_%' then
      coalesce((app_private.repay_streak(p_user_id)).best_streak >= (app_private.streak_voucher(p_reward)).min_streak, false)
    when p_reward = 'tier_rising' then
      app_private.pandesal_total(p_user_id) >= 60 and app_private.reached_rising_before_streaks(p_user_id)
    when p_reward in ('tier_prime', 'tier_apex') then
      app_private.pandesal_total(p_user_id) >= (app_private.tier_voucher(p_reward)).min_pandesal
    else false
  end;
$function$;

revoke all on function app_private.voucher_eligible(uuid, text) from public;

-- What the next on-time repayment is worth: for the loan card, the after-repayment screen and reminders.
--   current / best: the streak. nextStep: the streak count that pays the next voucher (null when none
--   is left). toGo: on-time repayments still needed. nextPhp: that voucher's amount.
create or replace function app_private.repay_reward_preview(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with s as (
    select r.current_streak as cur, r.best_streak as best, app_private.has_on_time_repayment(p_user_id) as first_done
    from app_private.repay_streak(p_user_id) r
  ),
  n as (
    select s.*,
      case when exists (select 1 from app_private.voucher_blocked_users b where b.user_id = p_user_id) then null
           when not first_done then 1
           when best < 3 then 3
           when best < 5 then 5
      end as next_step
    from s
  )
  select jsonb_build_object(
    'current', cur,
    'best', best,
    'nextStep', next_step,
    'toGo', case when next_step is null then null else greatest(next_step - cur, 1) end,
    'nextPhp', case when next_step is null then null else 50 end
  )
  from n;
$function$;

revoke all on function app_private.repay_reward_preview(uuid) from public;

-- For the reminder functions (service key only).
create or replace function public.repay_reward_previews(p_user_ids uuid[])
returns table (user_id uuid, preview jsonb)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select u.id, app_private.repay_reward_preview(u.id) from unnest(p_user_ids) as u(id);
$function$;

revoke all on function public.repay_reward_previews(uuid[]) from public, anon, authenticated;
grant execute on function public.repay_reward_previews(uuid[]) to service_role;

create or replace function public.get_my_rewards()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with me as (select auth.uid() as id),
  invited as (
    select r.id, r.created_at, app_private.has_on_time_repayment(r.referred_user_id, r.referrer_user_id) as qualified
    from public.friend_referrals r, me
    where r.referrer_user_id = me.id
  ),
  referred_by as (
    select r.id, r.referrer_user_id from public.friend_referrals r, me where r.referred_user_id = me.id
  ),
  claims as (
    select c.id, c.reward, c.friend_referral_id, c.status, c.brand, c.amount_php, c.sent_at, c.received_at, c.receipt_issue_at, c.created_at,
      case when c.status = 'sent' then (
        select coalesce(jsonb_agg(vc.code order by vc.created_at), '[]'::jsonb) from public.voucher_codes vc where vc.claim_id = c.id
      ) else '[]'::jsonb end as links
    from public.voucher_claims c, me where c.user_id = me.id
  ),
  eligible as (
    select t.reward, null::uuid as friend_referral_id, app_private.voucher_amount(t.reward) as amount_php
    from me, unnest(app_private.voucher_rewards()) as t(reward)
    where app_private.voucher_eligible(me.id, t.reward)
  )
  select jsonb_build_object(
    'invitedCount', (select count(*) from invited),
    'qualifiedCount', (select count(*) from invited where qualified),
    'wasReferred', exists (select 1 from referred_by),
    'streak', app_private.repay_reward_preview(me.id),
    'claims', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'reward', reward, 'friendReferralId', friend_referral_id, 'status', status, 'brand', brand,
        'amountPhp', amount_php, 'sentAt', sent_at, 'receivedAt', received_at, 'receiptIssueAt', receipt_issue_at,
        'links', links
      ) order by created_at desc) from claims), '[]'::jsonb),
    'claimable', coalesce((
      select jsonb_agg(jsonb_build_object('reward', e.reward, 'friendReferralId', e.friend_referral_id, 'amountPhp', e.amount_php)
        order by e.amount_php, e.reward)
      from eligible e
      where not exists (
        select 1 from claims c
        where c.reward = e.reward and c.friend_referral_id is not distinct from e.friend_referral_id and c.status <> 'rejected'
      )
    ), '[]'::jsonb)
  )
  from me
  where me.id is not null;
$function$;

create or replace function public.submit_voucher_claim(p_reward text, p_friend_referral_id uuid, p_full_name text, p_mobile text, p_email text default null::text, p_brand text default 'food'::text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if app_private.has_overdue_loan(v_user_id) then
    raise exception 'overdue loan: repay your loan to claim vouchers' using errcode = '42501';
  end if;

  if p_reward in ('referral_invitee', 'referral_inviter') then
    raise exception 'not eligible for this voucher' using errcode = '42501';
  elsif not (p_reward = any (app_private.voucher_rewards())) then
    raise exception 'unknown reward %', p_reward using errcode = '22023';
  end if;

  v_amount := app_private.voucher_amount(p_reward);
  if p_friend_referral_id is not null or not app_private.voucher_eligible(v_user_id, p_reward) then
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
  values (v_user_id, p_reward, null, v_amount, trim(p_full_name), trim(p_mobile), nullif(trim(coalesce(p_email, '')), ''), coalesce(p_brand, 'food'))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'voucher already claimed' using errcode = '23505';
end;
$function$;

create or replace function public.admin_unclaimed_vouchers()
returns table(user_id uuid, username text, display_name text, email text, reward text, friend_referral_id uuid, amount_php numeric)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select u.id, u.username, u.display_name, u.email, t.reward, null::uuid, app_private.voucher_amount(t.reward)
  from public.users u
  cross join unnest(app_private.voucher_rewards()) as t(reward)
  where not coalesce(u.is_test, false)
    and app_private.voucher_eligible(u.id, t.reward)
    and not exists (
      select 1 from public.voucher_claims c
      where c.user_id = u.id and c.reward = t.reward and c.status <> 'rejected'
    )
  order by u.username nulls last, t.reward;
end;
$function$;

create or replace function public.voucher_daily_digest()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with eligible as (
    select u.id as user_id, t.reward, app_private.voucher_amount(t.reward) as amount_php
    from public.users u
    cross join unnest(app_private.voucher_rewards()) as t(reward)
    where app_private.voucher_eligible(u.id, t.reward)
  ),
  unclaimed as (
    select e.user_id, sum(e.amount_php) as amount_php, count(*) as vouchers,
      jsonb_agg(jsonb_build_object('reward', e.reward, 'amountPhp', e.amount_php) order by e.amount_php) as rewards
    from eligible e
    where not exists (
      select 1 from public.voucher_claims c
      where c.user_id = e.user_id and c.reward = e.reward and c.status <> 'rejected'
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
      c.reward,
      c.amount_php,
      coalesce(c.sent_at, c.created_at) as since
    from public.voucher_claims c
    where c.status = 'pending' or (c.status = 'sent' and c.received_at is null)
  ),
  people as (
    select 'unclaimed' as bucket, user_id, amount_php, vouchers, rewards, null::timestamptz as since from unclaimed
    union all
    select bucket, user_id, sum(amount_php), count(*),
      jsonb_agg(jsonb_build_object('reward', reward, 'amountPhp', amount_php) order by amount_php), min(since)
    from claims group by bucket, user_id
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
          'rewards', p.rewards,
          'phone', coalesce(
            (select vc.mobile from public.voucher_claims vc where vc.user_id = u.id and nullif(btrim(vc.mobile), '') is not null order by vc.created_at desc limit 1),
            (select nullif(a.phone, '') from auth.users a where a.id = u.id),
            u.whatsapp_number
          ),
          'email', u.email,
          'days', case when p.since is null then null else floor(extract(epoch from now() - p.since) / 86400)::int end
        ) order by p.since nulls last, p.amount_php desc) as rows
      from people p
      join public.users u on u.id = p.user_id
      where not coalesce(u.is_test, false)
      group by p.bucket
    ) grouped
  ), '{}'::jsonb);
$function$;
