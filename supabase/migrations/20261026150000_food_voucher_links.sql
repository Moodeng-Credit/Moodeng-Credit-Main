-- Food vouchers: claims are sent automatically from a stock of Xoxoday reward links.
--
-- The team buys ₱50 Xoxoday "Xoxo Links" (campaign "Moodeng food reward": Jollibee, Chowking,
-- Greenwich, Mang Inasal, Red Ribbon; the borrower picks one) with Send to self, and pastes them on
-- the admin Vouchers page (public.voucher_codes). When a borrower claims a reward, the
-- notify_voucher_claim_telegram trigger calls voucher-claim-telegram-notification, which:
--   1. takes one ₱50 link per ₱50 of the reward (assign_voucher_codes), emails them and marks the
--      claim sent; if the email fails, release_voucher_code puts them back
--   2. if the stock is short, buys a Greenwich voucher on Bitrefill (BITREFILL_API_KEY in the
--      vault), which Bitrefill emails to the borrower
--   3. otherwise posts the admin card with ✅ Send code / ❌ Reject to retry after restocking

-- ── Link stock ──────────────────────────────────────────────────────────────────────────────────

create table if not exists public.voucher_codes (
  id          uuid primary key default gen_random_uuid(),
  amount_php  numeric(10, 2) not null check (amount_php > 0),
  code        text not null unique check (code = btrim(code) and char_length(code) between 4 and 500),
  source      text,
  added_by    uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- A ₱100 reward uses two ₱50 links, so a claim can hold several codes. assigned_at marks the
  -- code used for good: it stays set even if the claim is later deleted.
  claim_id    uuid references public.voucher_claims(id) on delete set null,
  assigned_at timestamptz
);

create index if not exists voucher_codes_available_idx
  on public.voucher_codes (amount_php, created_at)
  where assigned_at is null;
create index if not exists voucher_codes_claim_idx on public.voucher_codes (claim_id) where claim_id is not null;

alter table public.voucher_codes enable row level security;
-- No policies: codes are read and handed out only by the functions below.

-- Bitrefill purchase started for a claim, so a retry finishes it instead of buying (or sending) twice.
alter table public.voucher_claims add column if not exists bitrefill_invoice_id text;

-- Admin: add a batch of links of one value. Blank lines and links already in the stock are skipped.
create or replace function public.admin_add_voucher_codes(p_amount_php numeric, p_codes text[], p_source text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_added integer;
  v_total integer;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized';
  end if;
  if p_amount_php is null or p_amount_php <= 0 then
    raise exception 'the voucher value must be positive';
  end if;

  with input as (
    select distinct btrim(c) as code from unnest(coalesce(p_codes, '{}'::text[])) as c where btrim(c) <> ''
  ), ins as (
    insert into public.voucher_codes (amount_php, code, source, added_by)
    select p_amount_php, i.code, nullif(btrim(p_source), ''), auth.uid() from input i
    on conflict (code) do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from input) into v_added, v_total;

  return jsonb_build_object('added', v_added, 'skipped', v_total - v_added);
end;
$$;

-- Admin: how many links are left (and used) per value.
create or replace function public.admin_voucher_code_stock()
returns table (amount_php numeric, available bigint, used bigint)
language sql
stable
security definer
set search_path to ''
as $$
  select c.amount_php,
         count(*) filter (where c.assigned_at is null),
         count(*) filter (where c.assigned_at is not null)
    from public.voucher_codes as c
   where app_private.is_moodeng_admin()
   group by c.amount_php
   order by c.amount_php;
$$;

/**
 * Server only (edge functions): give a pending claim one ₱50 link per ₱50 of its value and mark it
 * sent. All or nothing: if the stock is short, nothing is taken. Returns the links and where to send
 * them (the claim's email, else the account's).
 */
create or replace function public.assign_voucher_codes(p_claim_id uuid, p_admin text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_claim  public.voucher_claims;
  v_needed integer;
  v_ids    uuid[];
  v_codes  text[];
  v_left   bigint;
  v_email  text;
begin
  select * into v_claim from public.voucher_claims where id = p_claim_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_claim.status <> 'pending' then
    return jsonb_build_object('error', 'not_pending', 'status', v_claim.status);
  end if;

  v_needed := greatest(ceil(v_claim.amount_php / 50.0)::int, 1);

  select array_agg(id), array_agg(code) into v_ids, v_codes
    from (
      select id, code from public.voucher_codes
       where assigned_at is null and amount_php = 50
       order by created_at, id
       limit v_needed
       for update skip locked
    ) picked;

  if coalesce(array_length(v_ids, 1), 0) < v_needed then
    select count(*) into v_left from public.voucher_codes where assigned_at is null and amount_php = 50;
    return jsonb_build_object('error', 'out_of_stock', 'needed', v_needed, 'available', v_left, 'amount_php', v_claim.amount_php);
  end if;

  update public.voucher_codes set claim_id = v_claim.id, assigned_at = now() where id = any (v_ids);
  update public.voucher_claims
     set status = 'sent',
         sent_at = now(),
         admin_note = left(concat_ws(' · ', nullif(admin_note, ''), 'Xoxo link sent by ' || coalesce(nullif(btrim(p_admin), ''), 'admin')), 500)
   where id = v_claim.id;

  select count(*) into v_left from public.voucher_codes where assigned_at is null and amount_php = 50;
  select coalesce(v_claim.email, u.email) into v_email from public.users u where u.id = v_claim.user_id;

  return jsonb_build_object(
    'codes', to_jsonb(v_codes),
    'amount_php', v_claim.amount_php,
    'email', v_email,
    'full_name', v_claim.full_name,
    'reward', v_claim.reward,
    'user_id', v_claim.user_id,
    'remaining', v_left
  );
end;
$$;

-- Server only: undo assign_voucher_codes when the email couldn't be sent.
create or replace function public.release_voucher_code(p_claim_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.voucher_codes set claim_id = null, assigned_at = null where claim_id = p_claim_id;
  update public.voucher_claims
     set status = 'pending',
         sent_at = null,
         admin_note = left(concat_ws(' · ', nullif(admin_note, ''), 'Email failed, links returned: ' || coalesce(p_reason, '?')), 500)
   where id = p_claim_id and status = 'sent';
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

revoke all on function public.assign_voucher_codes(uuid, text) from public, anon, authenticated;
revoke all on function public.release_voucher_code(uuid, text) from public, anon, authenticated;
revoke all on function public.bitrefill_api_key() from public, anon, authenticated;
grant execute on function public.assign_voucher_codes(uuid, text) to service_role;
grant execute on function public.release_voucher_code(uuid, text) to service_role;
grant execute on function public.bitrefill_api_key() to service_role;

revoke all on function public.admin_add_voucher_codes(numeric, text[], text) from public, anon;
revoke all on function public.admin_voucher_code_stock() from public, anon;
grant execute on function public.admin_add_voucher_codes(numeric, text[], text) to authenticated;
grant execute on function public.admin_voucher_code_stock() to authenticated;

-- ── Sending on claim ────────────────────────────────────────────────────────────────────────────

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

-- ── Moo-Menu: what the borrower picks, and whether they got it ─────────────────────────────────
-- 'food' = Xoxo link (Jollibee & co, anywhere in PH); 'grabmart' = Bitrefill GrabMart (₱100+, Metro
-- Manila and Cebu only). received_at / receipt_issue_at come from the borrower's "I got it" /
-- "Didn't get it" taps on the dashboard.
alter table public.voucher_claims add column if not exists brand text not null default 'food';
alter table public.voucher_claims drop constraint if exists voucher_claims_brand;
alter table public.voucher_claims add constraint voucher_claims_brand check (brand in ('food', 'grabmart'));
alter table public.voucher_claims add column if not exists received_at timestamptz;
alter table public.voucher_claims add column if not exists receipt_issue_at timestamptz;

-- The borrower confirms the voucher arrived (p_got_it true) or says it didn't (false).
create or replace function public.confirm_voucher_received(p_claim_id uuid, p_got_it boolean)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.voucher_claims
     set received_at = case when p_got_it then now() else received_at end,
         receipt_issue_at = case when p_got_it then null else now() end
   where id = p_claim_id and user_id = auth.uid() and status = 'sent';
  if not found then
    raise exception 'voucher not found' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.confirm_voucher_received(uuid, boolean) from public, anon;
grant execute on function public.confirm_voucher_received(uuid, boolean) to authenticated;

-- The voucher is emailed, so a claim needs an email; GrabMart needs ₱100+ (its smallest card).
-- Otherwise as in 20260925090000. The old five-argument version is replaced (brand is new).
drop function if exists public.submit_voucher_claim(text, uuid, text, text, text);
create or replace function public.submit_voucher_claim(p_reward text, p_friend_referral_id uuid, p_full_name text, p_mobile text, p_email text default null, p_brand text default 'food')
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
revoke all on function public.submit_voucher_claim(text, uuid, text, text, text, text) from public, anon;
grant execute on function public.submit_voucher_claim(text, uuid, text, text, text, text) to authenticated;

-- As in 20260925090000, plus each claim's id, brand, sent and received times (for the dashboard's
-- "Did you get it?" card).
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
    select c.id, c.reward, c.friend_referral_id, c.status, c.brand, c.amount_php, c.sent_at, c.received_at, c.receipt_issue_at, c.created_at
    from public.voucher_claims c, me where c.user_id = me.id
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
    'claims', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'reward', reward, 'friendReferralId', friend_referral_id, 'status', status, 'brand', brand,
        'amountPhp', amount_php, 'sentAt', sent_at, 'receivedAt', received_at, 'receiptIssueAt', receipt_issue_at
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
