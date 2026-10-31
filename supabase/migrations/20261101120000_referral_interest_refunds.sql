-- Referral interest refunds ("Pay zero interest — refer friends and we cover it").
--
-- Repayments go straight from the borrower's wallet to the lender's, so Moodeng can't waive interest
-- up front. Instead it refunds it: when a friend who joined with your invite code (friend_referrals)
-- has fully repaid a loan, the interest you paid on your latest repaid loan is queued here, capped at
-- $5, and the team sends it in USDC to your wallet (Admin → Referral codes → Interest refunds).
--
-- Rules (all checked here, never in the browser):
--   * The friend signed up with your code (friend_referrals) and fully repaid a loan: not refunded,
--     not a test loan, and not a loan you funded yourself.
--   * Your loan is fully repaid, not refunded, not a test loan, and had interest.
--   * One refund per friend, one refund per loan. If you have no repaid loan yet, the refund is queued
--     the moment you repay one.

create table if not exists public.interest_refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  friend_referral_id uuid unique references public.friend_referrals(id) on delete set null,
  loan_id uuid unique references public.loans(id) on delete set null,
  interest_usd numeric(10, 2) not null,
  amount_usd numeric(10, 2) not null,
  status text not null default 'pending',
  tx_hash text,
  sent_at timestamptz,
  sent_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interest_refunds_amount_positive check (amount_usd > 0 and amount_usd <= interest_usd),
  constraint interest_refunds_status check (status in ('pending', 'sent'))
);

create index if not exists idx_interest_refunds_user on public.interest_refunds (user_id);

drop trigger if exists update_interest_refunds_updated_at on public.interest_refunds;
create trigger update_interest_refunds_updated_at before update on public.interest_refunds
  for each row execute function public.update_updated_at_column();

alter table public.interest_refunds enable row level security;

drop policy if exists "Borrowers read their interest refunds" on public.interest_refunds;
create policy "Borrowers read their interest refunds" on public.interest_refunds
  for select to authenticated using (user_id = auth.uid() or app_private.is_moodeng_admin());

drop policy if exists "Admins update interest refunds" on public.interest_refunds;
create policy "Admins update interest refunds" on public.interest_refunds
  for update to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

revoke insert, update, delete on public.interest_refunds from anon, authenticated;
grant select on public.interest_refunds to authenticated;
-- Admins may only record the payment, never change who is owed or how much.
grant update (status, tx_hash, sent_at, sent_by) on public.interest_refunds to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Queueing
-- ---------------------------------------------------------------------------------------------

-- Same "fully repaid" test as app_private.has_on_time_repayment, without the on-time rule.
create or replace function app_private.is_fully_repaid_loan(l public.loans)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select l.repayment_status = 'Paid'
    and l.refunded_at is null
    and not coalesce(l.is_test, false)
    and case
          when coalesce(l.total_repayment_amount, 0) > 0 then coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
          else coalesce(l.repaid_amount, 0) > 0
        end;
$$;

create or replace function app_private.queue_interest_refunds(p_inviter uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_referral record;
  v_loan record;
  v_queued integer := 0;
begin
  if p_inviter is null then
    return 0;
  end if;

  for v_referral in
    select r.id
    from public.friend_referrals r
    where r.referrer_user_id = p_inviter
      and not exists (select 1 from public.interest_refunds ir where ir.friend_referral_id = r.id)
      and exists (
        select 1 from public.loans fl
        where fl.borrower_user_id = r.referred_user_id
          and fl.lender_user_id is distinct from p_inviter
          and app_private.is_fully_repaid_loan(fl)
      )
    order by r.created_at
  loop
    select l.id, round(l.total_repayment_amount - l.loan_amount, 2) as interest
      into v_loan
    from public.loans l
    where l.borrower_user_id = p_inviter
      and app_private.is_fully_repaid_loan(l)
      and coalesce(l.total_repayment_amount, 0) > coalesce(l.loan_amount, 0)
      and not exists (select 1 from public.interest_refunds ir where ir.loan_id = l.id)
    order by coalesce(l.repaid_at, l.updated_at) desc
    limit 1;

    -- No repaid loan of theirs left to refund: it's queued when they repay their next one.
    exit when v_loan.id is null;

    insert into public.interest_refunds (user_id, friend_referral_id, loan_id, interest_usd, amount_usd)
    values (p_inviter, v_referral.id, v_loan.id, v_loan.interest, least(v_loan.interest, 5))
    on conflict do nothing;
    v_queued := v_queued + 1;
  end loop;

  return v_queued;
end;
$$;

-- Any repayment can complete either side: the borrower as an inviter (their own loan) or as someone's
-- friend (the friend's loan). Never blocks the repayment itself.
create or replace function app_private.queue_interest_refunds_on_repayment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app_private.is_fully_repaid_loan(new) then
    return new;
  end if;
  begin
    perform app_private.queue_interest_refunds(new.borrower_user_id);
    perform app_private.queue_interest_refunds(r.referrer_user_id)
    from public.friend_referrals r
    where r.referred_user_id = new.borrower_user_id;
  exception when others then
    raise warning 'queue_interest_refunds failed for loan %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists queue_interest_refunds_on_repayment on public.loans;
create trigger queue_interest_refunds_on_repayment
  after insert or update of repayment_status, repaid_amount, refunded_at on public.loans
  for each row execute function app_private.queue_interest_refunds_on_repayment();

-- ---------------------------------------------------------------------------------------------
-- Borrower-facing: the refer page's tracker. Friends are shown without names.
-- ---------------------------------------------------------------------------------------------

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
        'sentAt', ir.sent_at,
        'txHash', ir.tx_hash
      ) order by f.created_at desc)
      from friends f
      left join public.interest_refunds ir on ir.friend_referral_id = f.id
    ), '[]'::jsonb),
    'totalRefundedUsd', coalesce((select sum(amount_usd) from public.interest_refunds, me where user_id = me.id and status = 'sent'), 0)
  );
$$;

revoke all on function public.get_my_interest_refunds() from public;
revoke all on function app_private.queue_interest_refunds(uuid) from public;
revoke all on function app_private.queue_interest_refunds_on_repayment() from public;
revoke all on function app_private.is_fully_repaid_loan(public.loans) from public;
grant execute on function public.get_my_interest_refunds() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The referral program pays back interest now, so referrals no longer earn the ₱100 food vouchers
-- (referral_inviter / referral_invitee). The food voucher program itself is unchanged: own first
-- on-time repayment and the tier vouchers still work. No referral voucher was ever claimed.
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_my_rewards()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
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
    select c.id, c.reward, c.friend_referral_id, c.status, c.brand, c.amount_php, c.sent_at, c.received_at, c.receipt_issue_at, c.created_at,
      case when c.status = 'sent' then (
        select coalesce(jsonb_agg(vc.code order by vc.created_at), '[]'::jsonb) from public.voucher_codes vc where vc.claim_id = c.id
      ) else '[]'::jsonb end as links
    from public.voucher_claims c, me where c.user_id = me.id
  ),
  eligible as (
    select 'first_on_time_repayment'::text as reward, null::uuid as friend_referral_id, 50::numeric as amount_php
    from me where app_private.has_on_time_repayment(me.id)
    union all
    select t.reward, null::uuid, (app_private.tier_voucher(t.reward)).amount_php
    from me, unnest(array['tier_rising', 'tier_prime', 'tier_apex']) as t(reward)
    where app_private.pandesal_total(me.id) >= (app_private.tier_voucher(t.reward)).min_pandesal
  )
  select jsonb_build_object(
    'invitedCount', (select count(*) from invited),
    'qualifiedCount', (select count(*) from invited where qualified),
    'wasReferred', exists (select 1 from referred_by),
    'claims', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'reward', reward, 'friendReferralId', friend_referral_id, 'status', status, 'brand', brand,
        'amountPhp', amount_php, 'sentAt', sent_at, 'receivedAt', received_at, 'receiptIssueAt', receipt_issue_at,
        'links', links
      ) order by created_at desc) from claims), '[]'::jsonb),
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

create or replace function public.submit_voucher_claim(
  p_reward text,
  p_friend_referral_id uuid,
  p_full_name text,
  p_mobile text,
  p_email text default null,
  p_brand text default 'food'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
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

  if app_private.has_overdue_loan(v_user_id) then
    raise exception 'overdue loan: repay your loan to claim vouchers' using errcode = '42501';
  end if;

  if p_reward = 'first_on_time_repayment' then
    v_amount := 50;
    v_eligible := p_friend_referral_id is null and app_private.has_on_time_repayment(v_user_id);
  elsif p_reward in ('referral_invitee', 'referral_inviter') then
    -- Referrals refund interest now (interest_refunds), not food vouchers.
    v_amount := 100;
    v_eligible := false;
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
$$;

-- ---------------------------------------------------------------------------------------------
-- Telegram: a card to the admin channel when a refund is owed (who, how much, which wallet, pay now),
-- stamped ✅ SENT when the team marks it sent. Same path as notify_referral_code_payout.
-- ---------------------------------------------------------------------------------------------

create or replace function private.notify_interest_refund()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'vault', 'net'
as $$
declare
  project_url text;
  service_key text;
  sent_by text;
  body jsonb;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;

  if project_url is null or service_key is null then
    raise warning 'Interest refund notification skipped: Supabase project URL or secret key missing from vault.';
    return new;
  end if;

  if tg_op = 'INSERT' then
    body := jsonb_build_object('interestRefundId', new.id);
  else
    select display_name into sent_by from public.admin_users where user_id = auth.uid() and active limit 1;
    body := jsonb_build_object('interestRefundId', new.id, 'event', 'sent', 'decidedBy', sent_by);
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/referral-payout-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := body
  );
  return new;
exception when others then
  raise warning 'Interest refund notification failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function private.notify_interest_refund() from public, anon, authenticated;

drop trigger if exists notify_interest_refund on public.interest_refunds;
create trigger notify_interest_refund
  after insert on public.interest_refunds
  for each row execute function private.notify_interest_refund();

drop trigger if exists notify_interest_refund_sent on public.interest_refunds;
create trigger notify_interest_refund_sent
  after update of status on public.interest_refunds
  for each row
  when (old.status is distinct from new.status and new.status = 'sent')
  execute function private.notify_interest_refund();
