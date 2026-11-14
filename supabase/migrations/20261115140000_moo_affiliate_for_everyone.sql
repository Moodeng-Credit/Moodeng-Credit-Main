-- Moo affiliate for everyone (builds on 20261115120000_affiliate_cash_per_friend).
--
-- 1. /affiliate works for every borrower: my_affiliate_dashboard() now also returns the borrower's
--    personal invite code ($5 per friend who repays, once they've repaid a loan themself) next to any
--    Belle-style referral code they own. A friend linked through both is shown and paid once, by the code.
-- 2. "Friend didn't use your code?" works for everyone. A hand-added friend the team approves is linked
--    to the owner (friend_referrals) and earns the $5 only if their account is at most 30 days older than
--    the claim; older friends are tracked only. Facebook link / phone are matched automatically to suggest
--    the account; the team still approves.
-- 3. Instagram + TikTok handles on the account (asked in the loan form from $60), shown to the team.
-- 4. A $5 still owed can be taken as a ₱250 food or Grab voucher instead (Giftaway), when giftaway_enabled
--    is on and the borrower is in the Philippines. Chosen in the Moo-Menu; the refund row becomes 'voucher'.

-- ── Payouts pause while the inviter has a past-due loan; a friend linked by a Belle-style code isn't paid twice.
alter table public.friend_referrals add column if not exists via_claim_id uuid;
alter table public.friend_referrals add column if not exists payout_eligible boolean not null default true;

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
     or app_private.has_overdue_loan(p_inviter)
     or not app_private.is_affiliate(p_inviter) then
    return 0;
  end if;

  insert into public.interest_refunds (user_id, friend_referral_id, loan_id, interest_usd, amount_usd, kind)
  select p_inviter, r.id, null, 0, 5, 'cash'
  from public.friend_referrals r
  join public.users fu on fu.id = r.referred_user_id
  where r.referrer_user_id = p_inviter
    and r.payout_eligible
    and r.referred_user_id <> p_inviter
    -- Paid through the inviter's own referral code instead (referral_code_payouts).
    and not exists (
      select 1 from public.referral_codes rc
      where rc.id = fu.redeemed_referral_code_id and rc.owner_user_id = p_inviter
    )
    and not exists (select 1 from public.interest_refunds ir where ir.friend_referral_id = r.id)
    and exists (
      select 1 from public.loans fl
      where fl.borrower_user_id = r.referred_user_id
        and fl.lender_user_id is distinct from p_inviter
        and not coalesce(fl.is_test, false)
        and app_private.is_fully_repaid_loan(fl)
        and app_private.loan_counts_for_rewards(fl)
    )
  order by r.created_at
  on conflict do nothing;

  get diagnostics v_queued = row_count;
  return v_queued;
end;
$$;

-- ── 4. Voucher instead of USDC: refund status 'voucher' + the claim it became.
alter table public.interest_refunds drop constraint if exists interest_refunds_status;
alter table public.interest_refunds
  add constraint interest_refunds_status check (status in ('pending', 'sent', 'voucher'));
alter table public.interest_refunds
  add column if not exists voucher_claim_id uuid references public.voucher_claims(id) on delete set null;

alter table public.voucher_claims drop constraint if exists voucher_claims_reward;
alter table public.voucher_claims add constraint voucher_claims_reward check (
  reward = any (array['first_on_time_repayment', 'referral_inviter', 'referral_invitee', 'tier_rising', 'tier_prime',
                      'tier_apex', 'streak_3', 'streak_5', 'affiliate_payout'])
);
alter table public.voucher_claims drop constraint if exists voucher_claims_referral_link;
alter table public.voucher_claims add constraint voucher_claims_referral_link check (
  reward in ('referral_inviter', 'referral_invitee', 'affiliate_payout') or friend_referral_id is null
);

-- The voucher a $5 becomes. Fixed, not a live conversion.
create or replace function app_private.affiliate_voucher_php()
returns numeric language sql immutable as $$ select 250::numeric $$;

create or replace function app_private.affiliate_voucher_available(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select value = 'true' from public.telegram_bot_settings where key = 'giftaway_enabled'), false)
     and coalesce((select market is distinct from 'ID' from public.users where id = p_user), false);
$$;

create or replace function public.submit_voucher_claim(p_reward text, p_friend_referral_id uuid, p_full_name text, p_mobile text, p_email text default null::text, p_brand text default 'food'::text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric;
  v_refund_id uuid;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if app_private.has_overdue_loan(v_user_id) then
    raise exception 'overdue loan: repay your loan to claim vouchers' using errcode = '42501';
  end if;

  if p_reward = 'affiliate_payout' then
    -- A $5 affiliate reward still owed for this friend, taken as a voucher instead of USDC.
    select id into v_refund_id from public.interest_refunds
    where user_id = v_user_id and friend_referral_id = p_friend_referral_id and kind = 'cash' and status = 'pending'
    for update;
    if v_refund_id is null or p_friend_referral_id is null or not app_private.affiliate_voucher_available(v_user_id) then
      raise exception 'not eligible for this voucher' using errcode = '42501';
    end if;
    v_amount := app_private.affiliate_voucher_php();
  elsif p_reward in ('referral_invitee', 'referral_inviter') then
    raise exception 'not eligible for this voucher' using errcode = '42501';
  elsif not (p_reward = any (app_private.voucher_rewards())) then
    raise exception 'unknown reward %', p_reward using errcode = '22023';
  else
    v_amount := app_private.voucher_amount(p_reward);
    if p_friend_referral_id is not null or not app_private.voucher_eligible(v_user_id, p_reward) then
      raise exception 'not eligible for this voucher' using errcode = '42501';
    end if;
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
  values (v_user_id, p_reward, case when p_reward = 'affiliate_payout' then p_friend_referral_id end, v_amount,
          trim(p_full_name), trim(p_mobile), nullif(trim(coalesce(p_email, '')), ''), coalesce(p_brand, 'food'))
  returning id into v_id;

  if v_refund_id is not null then
    update public.interest_refunds set status = 'voucher', voucher_claim_id = v_id, updated_at = now() where id = v_refund_id;
  end if;
  return v_id;
exception
  when unique_violation then
    raise exception 'voucher already claimed' using errcode = '23505';
end;
$$;

-- A rejected affiliate voucher goes back to "owed in USDC", so the friend's $5 is never lost.
create or replace function app_private.affiliate_voucher_rejected()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.reward = 'affiliate_payout' and new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.interest_refunds set status = 'pending', voucher_claim_id = null, updated_at = now()
    where voucher_claim_id = new.id and status = 'voucher';
  end if;
  return new;
end;
$$;

drop trigger if exists affiliate_voucher_rejected on public.voucher_claims;
create trigger affiliate_voucher_rejected after update of status on public.voucher_claims
  for each row execute function app_private.affiliate_voucher_rejected();

-- ── 3. Instagram + TikTok handles.
alter table public.users add column if not exists instagram_handle text;
alter table public.users add column if not exists tiktok_handle text;
alter table public.users add column if not exists social_handles_skipped_at timestamptz;
alter table public.users add column if not exists social_handles_updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_instagram_handle_format') then
    alter table public.users add constraint users_instagram_handle_format
      check (instagram_handle is null or instagram_handle ~ '^[a-z0-9._]{1,30}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_tiktok_handle_format') then
    alter table public.users add constraint users_tiktok_handle_format
      check (tiktok_handle is null or tiktok_handle ~ '^[a-z0-9._]{2,24}$');
  end if;
end $$;

create index if not exists users_instagram_handle_idx on public.users (instagram_handle) where instagram_handle is not null;
create index if not exists users_tiktok_handle_idx on public.users (tiktok_handle) where tiktok_handle is not null;

-- "@name", "name" or a profile link → the bare handle, lower case; null when empty or not a handle.
create or replace function app_private.clean_social_handle(p_value text, p_site text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := lower(trim(coalesce(p_value, '')));
begin
  v := regexp_replace(v, '^(https?://)?(www\.|m\.|vm\.)?', '');
  if p_site = 'instagram' then
    v := regexp_replace(v, '^(instagram\.com|instagr\.am)/', '');
  else
    v := regexp_replace(v, '^tiktok\.com/', '');
  end if;
  v := regexp_replace(v, '^@', '');
  v := split_part(split_part(split_part(v, '/', 1), '?', 1), '#', 1);
  if v = '' then
    return null;
  end if;
  if p_site = 'instagram' and v !~ '^[a-z0-9._]{1,30}$' then
    raise exception 'instagram_invalid' using errcode = '22023';
  end if;
  if p_site = 'tiktok' and v !~ '^[a-z0-9._]{2,24}$' then
    raise exception 'tiktok_invalid' using errcode = '22023';
  end if;
  return v;
end;
$$;

-- Saves both handles (empty clears one). p_skip = "I don't use these". Returns what's saved, plus whether
-- another account already uses either handle (the team sees that on the person card).
create or replace function public.save_my_social_handles(p_instagram text, p_tiktok text, p_skip boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ig text;
  v_tt text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  if coalesce(p_skip, false) then
    update public.users set social_handles_skipped_at = now() where id = auth.uid();
    return public.my_social_handles();
  end if;
  v_ig := app_private.clean_social_handle(p_instagram, 'instagram');
  v_tt := app_private.clean_social_handle(p_tiktok, 'tiktok');
  if v_ig is null and v_tt is null then
    raise exception 'handle_required' using errcode = '22023';
  end if;
  update public.users
  set instagram_handle = v_ig, tiktok_handle = v_tt, social_handles_updated_at = now(), social_handles_skipped_at = null
  where id = auth.uid();
  return public.my_social_handles();
end;
$$;

create or replace function public.my_social_handles()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'instagram', u.instagram_handle,
    'tiktok', u.tiktok_handle,
    'skipped', u.social_handles_skipped_at is not null,
    'updatedAt', u.social_handles_updated_at,
    'shared', exists (
      select 1 from public.users o
      where o.id <> u.id
        and ((u.instagram_handle is not null and o.instagram_handle = u.instagram_handle)
          or (u.tiktok_handle is not null and o.tiktok_handle = u.tiktok_handle))
    )
  )
  from public.users u
  where u.id = auth.uid();
$$;

-- ── 2. Hand-add a friend, for everyone.
alter table public.referral_claims alter column referral_code_id drop not null;
alter table public.referral_claims add column if not exists friend_facebook_url text;
alter table public.referral_claims add column if not exists suggested_user_id uuid references public.users(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'referral_claims_facebook_len') then
    alter table public.referral_claims add constraint referral_claims_facebook_len
      check (friend_facebook_url is null or char_length(friend_facebook_url) <= 300);
  end if;
end $$;

-- One friend counts once per owner on the personal list (code claims keep referral_claims_code_friend_key).
create unique index if not exists referral_claims_owner_friend_key
  on public.referral_claims (owner_user_id, matched_user_id) where status = 'approved' and referral_code_id is null;

-- facebook.com/name, m.facebook.com/name?ref=…, web.facebook.com/profile.php?id=1 → one form for matching.
create or replace function app_private.normalize_facebook_url(p_url text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := lower(trim(coalesce(p_url, '')));
  v_id text;
begin
  v := regexp_replace(v, '^(https?://)?((www|m|web|mbasic|touch)\.)?', '');
  v := regexp_replace(v, '^fb\.com/', 'facebook.com/');
  if v !~ '^facebook\.com/' then
    return null;
  end if;
  v_id := substring(v from 'profile\.php\?(?:.*&)?id=([0-9]+)');
  if v_id is not null then
    return 'facebook.com/profile.php?id=' || v_id;
  end if;
  v := split_part(split_part(v, '?', 1), '#', 1);
  v := regexp_replace(v, '/+$', '');
  return nullif(v, 'facebook.com');
end;
$$;

drop function if exists public.submit_referral_claim(text, text);
create or replace function public.submit_referral_claim(p_friend_name text, p_friend_contact text default null, p_facebook_url text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_code_id uuid;
  v_name text := left(regexp_replace(trim(coalesce(p_friend_name, '')), '\s+', ' ', 'g'), 80);
  v_contact text := nullif(left(trim(coalesce(p_friend_contact, '')), 120), '');
  v_fb_raw text := nullif(left(trim(coalesce(p_facebook_url, '')), 300), '');
  v_fb text;
  v_digits text;
  v_limit int;
  v_suggest uuid;
  v_matches int;
  v_id uuid;
  project_url text;
  service_key text;
begin
  if v_me is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select id into v_code_id from public.referral_codes where owner_user_id = v_me order by created_at limit 1;
  if v_code_id is null then
    perform public.get_my_invite_code();
  end if;
  if char_length(v_name) < 2 then
    raise exception 'Enter your friend''s name' using errcode = '22023';
  end if;
  if v_fb_raw is not null then
    v_fb := app_private.normalize_facebook_url(v_fb_raw);
    if v_fb is null then
      raise exception 'facebook_invalid' using errcode = '22023';
    end if;
  end if;
  v_limit := case when v_code_id is null then 3 else 20 end;
  if (select count(*) from public.referral_claims where owner_user_id = v_me and status = 'pending') >= v_limit then
    raise exception 'You have % friends waiting for us to check. We''ll get to them soon.', v_limit using errcode = '54000';
  end if;
  if exists (select 1 from public.referral_claims
             where owner_user_id = v_me and status = 'pending' and lower(friend_name) = lower(v_name)) then
    raise exception 'You already added % — we''re checking it.', v_name using errcode = '23505';
  end if;

  -- Suggest the account: same Facebook profile, or the same phone (last 10 digits). Only a single clear match.
  v_digits := right(regexp_replace(coalesce(v_contact, ''), '\D', '', 'g'), 10);
  with hits as (
    select u.id from public.users u
    where v_fb is not null and v_fb in (app_private.normalize_facebook_url(u.facebook_profile_url),
                                        app_private.normalize_facebook_url(u.facebook_contact))
    union
    select u.id from public.users u
    where char_length(v_digits) = 10 and right(regexp_replace(coalesce(u.whatsapp_number, ''), '\D', '', 'g'), 10) = v_digits
    union
    select au.id from auth.users au
    where char_length(v_digits) = 10 and right(regexp_replace(coalesce(au.phone, ''), '\D', '', 'g'), 10) = v_digits
  )
  select count(*), min(id::text)::uuid into v_matches, v_suggest from hits;
  if v_matches = 1 and v_suggest = v_me then
    raise exception 'self_claim' using errcode = '22023';
  end if;
  if v_matches <> 1 then
    v_suggest := null;
  end if;

  insert into public.referral_claims (referral_code_id, owner_user_id, friend_name, friend_contact, friend_facebook_url, suggested_user_id)
  values (v_code_id, v_me, v_name, v_contact, v_fb_raw, v_suggest)
  returning id into v_id;

  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;
  if project_url is not null and service_key is not null then
    perform net.http_post(
      url := project_url || '/functions/v1/referral-payout-telegram-notification',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
      body := jsonb_build_object('claimId', v_id));
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_decide_referral_claim(p_claim_id uuid, p_approve boolean, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claim public.referral_claims%rowtype;
  v_by text;
  v_code text;
  v_joined timestamptz;
  v_ref_id uuid;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into v_claim from public.referral_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'Already decided' using errcode = '22023';
  end if;
  if p_approve and p_user_id is null then
    raise exception 'Pick the user this friend is' using errcode = '22023';
  end if;
  if p_approve and p_user_id = v_claim.owner_user_id then
    raise exception 'That is the owner themself' using errcode = '22023';
  end if;

  if p_approve and v_claim.referral_code_id is not null then
    -- Belle-style code: tracking only, as before.
    if exists (select 1 from public.referral_claims
               where referral_code_id = v_claim.referral_code_id and matched_user_id = p_user_id
                 and status = 'approved' and id <> p_claim_id) then
      raise exception 'That person is already on this owner''s list' using errcode = '23505';
    end if;
    if exists (select 1 from public.users where id = p_user_id and redeemed_referral_code_id = v_claim.referral_code_id) then
      raise exception 'That person already used this code — they are on the list already' using errcode = '23505';
    end if;
  elsif p_approve then
    -- Personal code: link the friend to the owner. Pays $5 only if they joined at most 30 days before the claim.
    if exists (select 1 from public.friend_referrals where referred_user_id = p_user_id) then
      raise exception 'Already invited by someone else' using errcode = '23505';
    end if;
    if exists (select 1 from public.users u join public.referral_codes rc on rc.id = u.redeemed_referral_code_id
               where u.id = p_user_id and rc.owner_user_id is distinct from v_claim.owner_user_id) then
      raise exception 'They used another affiliate''s code' using errcode = '23505';
    end if;
    select code into v_code from public.borrower_invite_codes where user_id = v_claim.owner_user_id;
    select created_at into v_joined from public.users where id = p_user_id;
    if v_code is null or v_joined is null then
      raise exception 'Owner has no invite code' using errcode = 'P0002';
    end if;
    insert into public.friend_referrals (referrer_user_id, referred_user_id, code, via_claim_id, payout_eligible)
    values (v_claim.owner_user_id, p_user_id, v_code, v_claim.id, v_joined >= v_claim.created_at - interval '30 days')
    returning id into v_ref_id;
  end if;

  select display_name into v_by from public.admin_users where user_id = auth.uid() and active limit 1;
  update public.referral_claims
  set status = case when p_approve then 'approved' else 'rejected' end,
      matched_user_id = case when p_approve then p_user_id else null end,
      decided_at = now(),
      decided_by = coalesce(v_by, 'admin')
  where id = p_claim_id;

  -- The friend may have repaid already: queue the $5 now.
  if v_ref_id is not null then
    perform app_private.queue_interest_refunds(v_claim.owner_user_id);
  end if;
end;
$$;

-- ── 1. The dashboard, for everyone.
drop function if exists public.my_affiliate_dashboard();
create or replace function public.my_affiliate_dashboard()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
  v_result jsonb;
begin
  if v_me is null then
    return jsonb_build_object('codes', '[]'::jsonb, 'referrals', '[]'::jsonb, 'claims', '[]'::jsonb);
  end if;
  -- Every borrower has a personal code; make it on first visit.
  perform public.get_my_invite_code();

  with my_codes as (
    select rc.id, rc.code, rc.boost_amount, rc.payout_amount, rc.is_active, rc.expires_at, rc.max_uses, rc.current_uses
    from public.referral_codes rc
    where rc.owner_user_id = v_me
  ),
  personal as (
    select bic.code from public.borrower_invite_codes bic where bic.user_id = v_me
  ),
  unlocked as (
    select app_private.is_affiliate(v_me) as yes
  ),
  referred as (
    -- Belle-style codes, as before.
    select u.id, c.id as code_id, c.code, c.payout_amount as code_payout_amount, u.created_at, false as claimed,
      null::text as claimed_name, u.display_name, u.username, false as personal, null::uuid as friend_referral_id
    from public.users u
    join my_codes c on c.id = u.redeemed_referral_code_id
    where u.id <> v_me
    union all
    select u.id, c.id, c.code, 0, u.created_at, true, rcl.friend_name, u.display_name, u.username, false, null
    from public.referral_claims rcl
    join my_codes c on c.id = rcl.referral_code_id
    join public.users u on u.id = rcl.matched_user_id
    where rcl.status = 'approved' and u.id <> v_me
      and u.redeemed_referral_code_id is distinct from c.id
    union all
    -- Personal invite code (link, typed code, or a hand-added friend the team approved).
    select u.id, null, fr.code, 5, fr.created_at, not fr.payout_eligible, rcl.friend_name, u.display_name, u.username, true, fr.id
    from public.friend_referrals fr
    join public.users u on u.id = fr.referred_user_id
    left join public.referral_claims rcl on rcl.id = fr.via_claim_id
    where fr.referrer_user_id = v_me
      and not exists (select 1 from my_codes c where c.id = u.redeemed_referral_code_id)
  ),
  rows as (
    select
      coalesce(
        r.claimed_name,
        nullif(split_part(trim(r.display_name), ' ', 1), ''),
        nullif(trim(r.username), ''),
        'Friend'
      ) as first_name,
      r.code,
      r.created_at,
      r.claimed,
      r.personal,
      r.friend_referral_id,
      (r.personal and r.claimed_name is not null) as added_by_you,
      exists (
        select 1 from public.loans l
        where l.borrower_user_id = r.id
          and l.funded_at is not null
          and l.refunded_at is null
          and not coalesce(l.is_test, false)
      ) as borrowed,
      case
        when r.personal then ir.id is not null or exists (
          select 1 from public.loans l
          where l.borrower_user_id = r.id
            and l.lender_user_id is distinct from v_me
            and not coalesce(l.is_test, false)
            and app_private.is_fully_repaid_loan(l)
            and app_private.loan_counts_for_rewards(l)
        )
        when r.claimed then exists (
          select 1 from public.loans l
          where l.borrower_user_id = r.id
            and l.repayment_status = 'Paid'
            and l.refunded_at is null
            and not coalesce(l.is_test, false)
        )
        else p.id is not null
      end as repaid,
      -- Repaid, but only loans that don't count yet (held under 24h, or funded by you).
      r.personal and ir.id is null and exists (
        select 1 from public.loans l
        where l.borrower_user_id = r.id and not coalesce(l.is_test, false) and app_private.is_fully_repaid_loan(l)
      ) as repaid_not_counted,
      case when r.claimed then 0 when r.personal then coalesce(ir.amount_usd, 5) else coalesce(p.amount, r.code_payout_amount) end
        as payout_amount,
      case
        when r.personal then case ir.status when 'sent' then 'paid' when 'pending' then 'unpaid' when 'voucher' then 'voucher' end
        else p.status
      end as payout_status,
      case when r.personal then ir.sent_at else p.paid_at end as paid_at,
      vc.status as voucher_status,
      vc.amount_php as voucher_php
    from referred r
    left join public.referral_code_payouts p on not r.personal and not r.claimed and p.referred_user_id = r.id and p.referral_code_id = r.code_id
    left join public.interest_refunds ir on r.personal and ir.friend_referral_id = r.friend_referral_id and ir.kind = 'cash'
    left join public.voucher_claims vc on vc.id = ir.voucher_claim_id
  )
  select jsonb_build_object(
    'unlocked', (select yes from unlocked) or exists (select 1 from my_codes),
    'paused', app_private.has_overdue_loan(v_me) or exists (select 1 from app_private.voucher_blocked_users b where b.user_id = v_me),
    'voucher', jsonb_build_object(
      'available', app_private.affiliate_voucher_available(v_me),
      'amountPhp', app_private.affiliate_voucher_php()
    ),
    'codes', coalesce((
      select jsonb_agg(c order by c ->> 'personal', c ->> 'code')
      from (
        select jsonb_build_object(
          'code', code,
          'boost_amount', boost_amount,
          'payout_amount', payout_amount,
          'is_active', is_active and (expires_at is null or expires_at > now()) and (max_uses is null or current_uses < max_uses),
          'personal', false
        ) as c
        from my_codes
        union all
        select jsonb_build_object('code', code, 'boost_amount', 0, 'payout_amount', 5, 'is_active', true, 'personal', true)
        from personal
      ) all_codes
    ), '[]'::jsonb),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'first_name', first_name,
        'code', code,
        'joined_at', created_at,
        'claimed', claimed,
        'personal', personal,
        'added_by_you', added_by_you,
        'friend_referral_id', case when personal then friend_referral_id end,
        'borrowed', borrowed,
        'repaid', repaid,
        'repaid_not_counted', repaid_not_counted and not repaid,
        'payout_amount', payout_amount,
        'payout_status', payout_status,
        'paid_at', paid_at,
        'voucher_status', voucher_status,
        'voucher_php', voucher_php
      ) order by created_at desc)
      from rows
    ), '[]'::jsonb),
    'claims', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', rcl.id,
        'friend_name', rcl.friend_name,
        'status', rcl.status,
        'created_at', rcl.created_at
      ) order by rcl.created_at desc)
      from public.referral_claims rcl
      where rcl.owner_user_id = v_me and rcl.status in ('pending', 'rejected')
        and rcl.created_at > now() - interval '30 days'
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Team view of a person's handles (admin person card / call sheet).
create or replace function public.admin_social_handles(p_user_ids uuid[])
returns table (user_id uuid, instagram_handle text, tiktok_handle text, skipped boolean, shared boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.current_user_is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select u.id, u.instagram_handle, u.tiktok_handle, u.social_handles_skipped_at is not null,
    exists (
      select 1 from public.users o
      where o.id <> u.id
        and ((u.instagram_handle is not null and o.instagram_handle = u.instagram_handle)
          or (u.tiktok_handle is not null and o.tiktok_handle = u.tiktok_handle))
    )
  from public.users u
  where u.id = any (p_user_ids);
end;
$$;

revoke all on function app_private.queue_interest_refunds(uuid) from public;
revoke all on function app_private.affiliate_voucher_available(uuid) from public;
revoke all on function app_private.affiliate_voucher_rejected() from public;
revoke all on function app_private.clean_social_handle(text, text) from public;
revoke all on function app_private.normalize_facebook_url(text) from public;
revoke all on function public.submit_voucher_claim(text, uuid, text, text, text, text) from public, anon;
revoke all on function public.save_my_social_handles(text, text, boolean) from public, anon;
revoke all on function public.my_social_handles() from public, anon;
revoke all on function public.submit_referral_claim(text, text, text) from public, anon;
revoke all on function public.admin_decide_referral_claim(uuid, boolean, uuid) from public, anon;
revoke all on function public.my_affiliate_dashboard() from public, anon;
revoke all on function public.admin_social_handles(uuid[]) from public, anon;
grant execute on function public.submit_voucher_claim(text, uuid, text, text, text, text) to authenticated;
grant execute on function public.save_my_social_handles(text, text, boolean) to authenticated;
grant execute on function public.my_social_handles() to authenticated;
grant execute on function public.submit_referral_claim(text, text, text) to authenticated;
grant execute on function public.admin_decide_referral_claim(uuid, boolean, uuid) to authenticated;
grant execute on function public.my_affiliate_dashboard() to authenticated;
grant execute on function public.admin_social_handles(uuid[]) to authenticated;
