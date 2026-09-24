-- Pandesal for every on-time repayment + GrabFood vouchers at each Moodeng tier.
--
-- Before this, pandesal only came from 10 one-time milestones (305 total), so the Prime (300) and
-- Apex (600) tiers were effectively unreachable and good borrowers stopped earning. Now:
--   * every loan fully repaid on time earns +10 pandesal
--   * on-time streaks earn a one-off bonus at 3 (+15), 5 (+25) and 10 (+50) in a row; a late
--     repayment breaks the streak (nothing is taken away)
--   * reaching a tier unlocks a one-time GrabFood voucher: Rising ₱50, Prime ₱100, Apex ₱150
--     (on top of the existing ₱50 first-on-time-repayment voucher → ₱350 per borrower in total)
--
-- Tier thresholds (pandesal): Rookie 0, Rising 60, Prime 200, Apex 400. Keep in sync with
-- MOODENG_TIERS in src/views/dashboard-v2/dashboardV2Model.ts.
-- Points are stored in minor units: 1 pandesal = 1,000,000 (same as milestone_definitions.points_awarded).

-- ── Pandesal for on-time repayments ─────────────────────────────────────────────────────────────

create or replace function app_private.is_loan_fully_repaid(p_loan public.loans)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_loan.repayment_status::text = 'Paid'
    and p_loan.refunded_at is null
    and not coalesce(p_loan.is_test, false)
    and case
          when coalesce(p_loan.total_repayment_amount, 0) > 0 then coalesce(p_loan.repaid_amount, 0) >= p_loan.total_repayment_amount
          else coalesce(p_loan.repaid_amount, 0) > 0
        end;
$$;

-- Same on-time rule as app_private.has_on_time_repayment and src/lib/creditLeveling.ts.
create or replace function app_private.is_loan_repaid_on_time(p_loan public.loans)
returns boolean
language sql
stable
set search_path = ''
as $$
  select app_private.is_loan_fully_repaid(p_loan)
    and coalesce(p_loan.repaid_at, p_loan.updated_at) < p_loan.due_date + interval '24 hours';
$$;

/**
 * Award the pandesal for one repaid loan: +10 if on time, plus a streak bonus when this repayment
 * makes the borrower's run of consecutive on-time repayments exactly 3, 5 or 10. Idempotent: every
 * award is keyed on (user, source, loan, event) by trust_point_events_unique_event.
 */
create or replace function private.award_repayment_pandesal(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans;
  v_paid_at timestamptz;
  v_streak int := 0;
  v_bonus bigint;
  prior public.loans;
begin
  select * into v_loan from public.loans where id = p_loan_id;
  if v_loan.id is null or v_loan.borrower_user_id is null or not app_private.is_loan_repaid_on_time(v_loan) then
    return;
  end if;

  perform private.award_trust_points(
    v_loan.borrower_user_id, 'loan_repayment', v_loan.id, 'on_time_repayment', 10000000,
    jsonb_build_object('loan_id', v_loan.id, 'reason', 'On-time repayment')
  );

  -- Count consecutive on-time repayments ending at this one (newest first), stopping at the first late one.
  v_paid_at := coalesce(v_loan.repaid_at, v_loan.updated_at);
  for prior in
    select l.*
    from public.loans l
    where l.borrower_user_id = v_loan.borrower_user_id
      and app_private.is_loan_fully_repaid(l)
      and coalesce(l.repaid_at, l.updated_at) <= v_paid_at
    order by coalesce(l.repaid_at, l.updated_at) desc, l.id desc
  loop
    exit when not app_private.is_loan_repaid_on_time(prior);
    v_streak := v_streak + 1;
  end loop;

  v_bonus := case v_streak when 3 then 15000000 when 5 then 25000000 when 10 then 50000000 else null end;
  if v_bonus is not null then
    perform private.award_trust_points(
      v_loan.borrower_user_id, 'loan_repayment', v_loan.id, 'on_time_streak_' || v_streak, v_bonus,
      jsonb_build_object('loan_id', v_loan.id, 'streak', v_streak, 'reason', v_streak || ' on-time repayments in a row')
    );
  end if;
end;
$$;

create or replace function private.award_repayment_pandesal_from_loan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.award_repayment_pandesal(new.id);
  return new;
end;
$$;

drop trigger if exists award_repayment_pandesal_on_loans on public.loans;
create trigger award_repayment_pandesal_on_loans
  after insert or update of repayment_status, repaid_amount, total_repayment_amount, repaid_at, refunded_at
  on public.loans
  for each row
  when (new.repayment_status::text = 'Paid')
  execute function private.award_repayment_pandesal_from_loan();

revoke all on function private.award_repayment_pandesal(uuid) from public, anon, authenticated;
revoke all on function private.award_repayment_pandesal_from_loan() from public, anon, authenticated;

-- Backfill: credit every on-time repayment made before this migration, oldest first so streak
-- bonuses land on the loan that completed each streak.
do $$
declare
  l record;
begin
  for l in
    select id from public.loans
    where repayment_status::text = 'Paid'
    order by coalesce(repaid_at, updated_at), id
  loop
    perform private.award_repayment_pandesal(l.id);
  end loop;
end;
$$;

-- ── GrabFood vouchers at each tier ──────────────────────────────────────────────────────────────

create or replace function app_private.pandesal_total(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select points_total from public.user_trust_points where user_id = p_user_id), 0) / 1000000.0;
$$;

-- reward → (tier threshold, voucher amount)
create or replace function app_private.tier_voucher(p_reward text, out min_pandesal numeric, out amount_php numeric)
language sql
immutable
set search_path = ''
as $$
  select v.min_pandesal, v.amount_php
  from (values ('tier_rising', 60::numeric, 50::numeric), ('tier_prime', 200, 100), ('tier_apex', 400, 150)) as v(reward, min_pandesal, amount_php)
  where v.reward = p_reward;
$$;

alter table public.voucher_claims drop constraint if exists voucher_claims_reward;
alter table public.voucher_claims add constraint voucher_claims_reward
  check (reward = any (array['first_on_time_repayment', 'referral_inviter', 'referral_invitee', 'tier_rising', 'tier_prime', 'tier_apex']));

alter table public.voucher_claims drop constraint if exists voucher_claims_referral_link;
alter table public.voucher_claims add constraint voucher_claims_referral_link
  check (reward in ('referral_inviter', 'referral_invitee') or friend_referral_id is null);

create unique index if not exists voucher_claims_tier_once
  on public.voucher_claims (user_id, reward)
  where reward like 'tier\_%' and status <> 'rejected';

create or replace function public.submit_voucher_claim(p_reward text, p_friend_referral_id uuid, p_full_name text, p_mobile text, p_email text default null)
returns uuid
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
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

  insert into public.voucher_claims (user_id, reward, friend_referral_id, amount_php, full_name, mobile, email)
  values (v_user_id, p_reward, p_friend_referral_id, v_amount, trim(p_full_name), trim(p_mobile), nullif(trim(coalesce(p_email, '')), ''))
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'voucher already claimed' using errcode = '23505';
end;
$$;

create or replace function public.get_my_rewards()
returns jsonb
language sql
stable
security definer
set search_path = 'public', 'pg_temp'
as $$
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
    select c.reward, c.friend_referral_id, c.status, c.created_at from public.voucher_claims c, me where c.user_id = me.id
  ),
  eligible as (
    select 'first_on_time_repayment'::text as reward, null::uuid as friend_referral_id, 50::numeric as amount_php
    from me where app_private.has_on_time_repayment(me.id)
    union all
    select 'referral_invitee', rb.id, 100 from referred_by rb, me where app_private.has_on_time_repayment(me.id, rb.referrer_user_id)
    union all
    select 'referral_inviter', i.id, 100 from invited i where i.qualified
    union all
    select t.reward, null::uuid, (app_private.tier_voucher(t.reward)).amount_php
    from me, unnest(array['tier_rising', 'tier_prime', 'tier_apex']) as t(reward)
    where app_private.pandesal_total(me.id) >= (app_private.tier_voucher(t.reward)).min_pandesal
  )
  select jsonb_build_object(
    'invitedCount', (select count(*) from invited),
    'qualifiedCount', (select count(*) from invited where qualified),
    'wasReferred', exists (select 1 from referred_by),
    'claims', coalesce((select jsonb_agg(jsonb_build_object('reward', reward, 'friendReferralId', friend_referral_id, 'status', status) order by created_at desc) from claims), '[]'::jsonb),
    'claimable', coalesce((
      select jsonb_agg(jsonb_build_object('reward', e.reward, 'friendReferralId', e.friend_referral_id, 'amountPhp', e.amount_php))
      from eligible e
      where not exists (
        select 1 from claims c
        where c.reward = e.reward and c.friend_referral_id is not distinct from e.friend_referral_id and c.status <> 'rejected'
      )
    ), '[]'::jsonb)
  )
  from me
  where me.id is not null;
$$;
