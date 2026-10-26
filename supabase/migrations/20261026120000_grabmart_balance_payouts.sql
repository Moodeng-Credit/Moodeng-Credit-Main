-- Rewards bank into a GrabMart balance; every ₱100 becomes one GrabMart code.
--
-- No provider sells Grab PH codes as small as ₱50 (Bitrefill GrabMart PH starts at ₱100, with no
-- minimum basket; GrabFood starts at ₱200 and needs a ₱500 order). So the ₱50 rewards can't each be
-- their own code. Now:
--   * claiming a reward (submit_voucher_claim) stores it as status 'banked': it adds to the
--     borrower's GrabMart balance and posts no admin card
--   * whenever banked total − payouts issued reaches ₱100, a 'grabmart_payout' claim of ₱100 is
--     created with status 'pending'. voucher-claim-telegram-notification sends it straight away
--     (Bitrefill API, or the next code from public.voucher_codes); if it can't, the Telegram card
--     keeps ✅ Send code / ❌ Reject as before
--   * rejecting a payout puts its ₱100 back in the balance (and re-issues if still ≥ ₱100)
--   * Bitrefill emails the voucher to the borrower (its gift delivery), so a claim now needs an email
--
-- Balance = banked reward claims − non-rejected payouts (a reward sent on its own, the old way,
-- doesn't count). Keep GRABMART_PAYOUT_PHP in src/lib/friendReferrals.ts in sync.
--
-- Deploy voucher-claim-telegram-notification before applying: the backfill at the bottom issues
-- payouts, which call it.

alter table public.voucher_claims drop constraint if exists voucher_claims_status;
alter table public.voucher_claims add constraint voucher_claims_status
  check (status in ('banked', 'pending', 'sent', 'rejected'));

alter table public.voucher_claims drop constraint if exists voucher_claims_reward;
alter table public.voucher_claims add constraint voucher_claims_reward
  check (reward = any (array['first_on_time_repayment', 'referral_inviter', 'referral_invitee', 'tier_rising', 'tier_prime', 'tier_apex', 'grabmart_payout']));

-- Bitrefill invoice bought for a payout, so a retry finishes that purchase instead of buying again.
alter table public.voucher_claims add column if not exists bitrefill_invoice_id text;

-- ₱ earned toward GrabMart codes, minus ₱ already issued as payouts.
create or replace function app_private.grabmart_balance(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(case when c.reward = 'grabmart_payout' then -c.amount_php else c.amount_php end), 0)
  from public.voucher_claims c
  where c.user_id = p_user_id
    and case when c.reward = 'grabmart_payout' then c.status <> 'rejected' else c.status = 'banked' end;
$$;

/**
 * Issue one ₱100 GrabMart payout per full ₱100 of balance, sent to the borrower's most recent claim
 * contact. Serialised per user so two claims landing together can't double-issue.
 */
create or replace function private.issue_grabmart_payouts(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact record;
  v_issued integer := 0;
begin
  perform pg_advisory_xact_lock(hashtext('grabmart_payout:' || p_user_id::text));

  select c.full_name, c.mobile, c.email into v_contact
  from public.voucher_claims c
  where c.user_id = p_user_id and c.reward <> 'grabmart_payout'
  order by c.created_at desc
  limit 1;
  if v_contact is null then
    return 0;
  end if;

  while app_private.grabmart_balance(p_user_id) >= 100 loop
    insert into public.voucher_claims (user_id, reward, amount_php, full_name, mobile, email, status)
    values (p_user_id, 'grabmart_payout', 100, v_contact.full_name, v_contact.mobile, v_contact.email, 'pending');
    v_issued := v_issued + 1;
  end loop;
  return v_issued;
end;
$$;

create or replace function private.issue_grabmart_payouts_from_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.issue_grabmart_payouts(new.user_id);
  return new;
end;
$$;

revoke all on function private.issue_grabmart_payouts(uuid) from public, anon, authenticated;
revoke all on function private.issue_grabmart_payouts_from_claim() from public, anon, authenticated;
revoke all on function app_private.grabmart_balance(uuid) from public, anon, authenticated;

drop trigger if exists issue_grabmart_payouts_on_banked on public.voucher_claims;
create trigger issue_grabmart_payouts_on_banked
  after insert on public.voucher_claims
  for each row
  when (new.status = 'banked')
  execute function private.issue_grabmart_payouts_from_claim();

drop trigger if exists issue_grabmart_payouts_on_payout_rejected on public.voucher_claims;
create trigger issue_grabmart_payouts_on_payout_rejected
  after update of status on public.voucher_claims
  for each row
  when (new.reward = 'grabmart_payout' and new.status = 'rejected' and old.status is distinct from 'rejected')
  execute function private.issue_grabmart_payouts_from_claim();

-- Same as 20260925110000_voucher_claim_telegram, with a longer timeout: sending can include a
-- Bitrefill purchase (~20s).
create or replace function private.notify_voucher_claim_telegram()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'vault', 'net'
as $$
declare
  project_url text;
  service_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;

  if project_url is null or service_key is null then
    raise warning 'Voucher claim notification skipped: Supabase project URL or secret key missing from vault.';
    return new;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/voucher-claim-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('claimId', new.id),
    timeout_milliseconds := 60000
  );
  return new;
end;
$$;

-- Only payouts (status 'pending' on insert) need sending; banked rewards are silent.
drop trigger if exists notify_voucher_claim_telegram on public.voucher_claims;
create trigger notify_voucher_claim_telegram
  after insert on public.voucher_claims
  for each row
  when (new.status = 'pending')
  execute function private.notify_voucher_claim_telegram();

-- As in 20261004140000_voucher_code_pool, but falls back to the borrower's account email when the
-- claim's email was left blank (the edge function skips placeholder addresses; the code still shows
-- in the app).
create or replace function public.assign_voucher_code(p_claim_id uuid, p_admin text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_claim public.voucher_claims;
  v_code  public.voucher_codes;
  v_left  bigint;
  v_email text;
begin
  select * into v_claim from public.voucher_claims where id = p_claim_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_claim.status <> 'pending' then
    return jsonb_build_object('error', 'not_pending', 'status', v_claim.status);
  end if;

  select * into v_code
    from public.voucher_codes
   where assigned_at is null and amount_php = v_claim.amount_php
   order by created_at, id
   limit 1
   for update skip locked;
  if not found then
    return jsonb_build_object('error', 'out_of_stock', 'amount_php', v_claim.amount_php);
  end if;

  update public.voucher_codes set claim_id = v_claim.id, assigned_at = now() where id = v_code.id;
  update public.voucher_claims
     set status = 'sent',
         sent_at = now(),
         admin_note = left(concat_ws(' · ', nullif(admin_note, ''), 'Code sent by ' || coalesce(nullif(btrim(p_admin), ''), 'admin')), 500)
   where id = v_claim.id;

  select count(*) into v_left from public.voucher_codes where assigned_at is null and amount_php = v_claim.amount_php;
  select coalesce(v_claim.email, u.email) into v_email from public.users u where u.id = v_claim.user_id;

  return jsonb_build_object(
    'code', v_code.code,
    'amount_php', v_claim.amount_php,
    'email', v_email,
    'full_name', v_claim.full_name,
    'reward', v_claim.reward,
    'user_id', v_claim.user_id,
    'remaining', v_left
  );
end;
$$;

-- Server only: the Bitrefill API key from the vault (edge function secrets are at their cap).
create or replace function public.bitrefill_api_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'BITREFILL_API_KEY' limit 1;
$$;
revoke all on function public.bitrefill_api_key() from public, anon, authenticated;
grant execute on function public.bitrefill_api_key() to service_role;

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
  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'email required: the voucher is emailed' using errcode = '22023';
  end if;

  insert into public.voucher_claims (user_id, reward, friend_referral_id, amount_php, full_name, mobile, email, status)
  values (v_user_id, p_reward, p_friend_referral_id, v_amount, trim(p_full_name), trim(p_mobile), nullif(trim(coalesce(p_email, '')), ''), 'banked')
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'voucher already claimed' using errcode = '23505';
end;
$$;

-- Same as before, plus the GrabMart balance (₱ saved below ₱100) and payout statuses. Payouts are
-- never "claimable" and don't appear in claims.
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
    select c.reward, c.friend_referral_id, c.status, c.created_at from public.voucher_claims c, me
    where c.user_id = me.id and c.reward <> 'grabmart_payout'
  ),
  payouts as (
    select c.amount_php, c.status, c.sent_at, c.created_at
    from public.voucher_claims c
    join me on c.user_id = me.id
    where c.reward = 'grabmart_payout' and c.status <> 'rejected'
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
    ), '[]'::jsonb),
    'grabmartBalancePhp', app_private.grabmart_balance(me.id),
    'grabmartPayouts', coalesce((
      select jsonb_agg(jsonb_build_object('amountPhp', amount_php, 'status', status, 'sentAt', sent_at) order by created_at desc)
      from payouts
    ), '[]'::jsonb)
  )
  from me
  where me.id is not null;
$$;

-- Existing claims nobody has been sent yet: bank them, then issue payouts for anyone at ₱100+.
-- (No claim had been sent as of 2026-10-26.)
update public.voucher_claims
set status = 'banked', admin_note = coalesce(admin_note, 'banked toward GrabMart ₱100 (2026-10-26)')
where status = 'pending' and reward <> 'grabmart_payout';

do $$
declare
  u record;
begin
  for u in select distinct user_id from public.voucher_claims where status = 'banked' loop
    perform private.issue_grabmart_payouts(u.user_id);
  end loop;
end;
$$;
