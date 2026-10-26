-- Affiliate referral claims: a code owner (e.g. Belle) tells us about friends they brought in who
-- never typed the code. They add a name on /affiliate → Telegram card → the team finds the person
-- in Admin → Referral codes and approves → the friend shows on the owner's dashboard.
--
-- Tracking only: an approved claim never sets users.redeemed_referral_code_id, so it never creates
-- a referral_code_payouts row (no "needs money" card), never changes the friend's loan flow, and
-- never gives them the code's boost. Claimed friends show without any money on /affiliate.

create table if not exists public.referral_claims (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  friend_name text not null check (char_length(friend_name) between 2 and 80),
  friend_contact text check (friend_contact is null or char_length(friend_contact) <= 120),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  matched_user_id uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  decided_by text,
  created_at timestamptz not null default now(),
  check (status <> 'approved' or matched_user_id is not null)
);

create index if not exists referral_claims_owner_idx on public.referral_claims (owner_user_id, created_at desc);
-- One friend counts once per code, however many times it's claimed.
create unique index if not exists referral_claims_code_friend_key
  on public.referral_claims (referral_code_id, matched_user_id) where status = 'approved';

alter table public.referral_claims enable row level security;

drop policy if exists "Admins read referral claims" on public.referral_claims;
create policy "Admins read referral claims" on public.referral_claims
  for select to authenticated using (private.current_user_is_admin());

revoke all on public.referral_claims from anon, authenticated;
grant select on public.referral_claims to authenticated;

-- Owner adds a friend they referred. Posts the Telegram card via referral-payout-telegram-notification.
create or replace function public.submit_referral_claim(p_friend_name text, p_friend_contact text default null)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_code_id uuid;
  v_name text := left(regexp_replace(trim(coalesce(p_friend_name, '')), '\s+', ' ', 'g'), 80);
  v_contact text := nullif(left(trim(coalesce(p_friend_contact, '')), 120), '');
  v_id uuid;
  project_url text;
  service_key text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first' using errcode = '28000';
  end if;
  select id into v_code_id from public.referral_codes where owner_user_id = auth.uid() order by created_at limit 1;
  if v_code_id is null then
    raise exception 'No affiliate code on this account' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 then
    raise exception 'Enter your friend''s name' using errcode = '22023';
  end if;
  if (select count(*) from public.referral_claims where owner_user_id = auth.uid() and status = 'pending') >= 20 then
    raise exception 'You have 20 friends waiting for us to check. We''ll get to them soon.' using errcode = '54000';
  end if;
  if exists (select 1 from public.referral_claims
             where owner_user_id = auth.uid() and status = 'pending' and lower(friend_name) = lower(v_name)) then
    raise exception 'You already added % — we''re checking it.', v_name using errcode = '23505';
  end if;

  insert into public.referral_claims (referral_code_id, owner_user_id, friend_name, friend_contact)
  values (v_code_id, auth.uid(), v_name, v_contact)
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

revoke all on function public.submit_referral_claim(text, text) from public, anon;
grant execute on function public.submit_referral_claim(text, text) to authenticated;

-- Admin approves (with the matched user) or rejects a claim.
create or replace function public.admin_decide_referral_claim(p_claim_id uuid, p_approve boolean, p_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_claim public.referral_claims%rowtype;
  v_by text;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into v_claim from public.referral_claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if p_approve and p_user_id is null then
    raise exception 'Pick the user this friend is' using errcode = '22023';
  end if;
  if p_approve and p_user_id = v_claim.owner_user_id then
    raise exception 'That is the code owner themself' using errcode = '22023';
  end if;
  if p_approve and exists (select 1 from public.referral_claims
                           where referral_code_id = v_claim.referral_code_id and matched_user_id = p_user_id
                             and status = 'approved' and id <> p_claim_id) then
    raise exception 'That person is already on this owner''s list' using errcode = '23505';
  end if;
  if p_approve and exists (select 1 from public.users where id = p_user_id and redeemed_referral_code_id = v_claim.referral_code_id) then
    raise exception 'That person already used this code — they are on the list already' using errcode = '23505';
  end if;

  select display_name into v_by from public.admin_users where user_id = auth.uid() and active limit 1;
  update public.referral_claims
  set status = case when p_approve then 'approved' else 'rejected' end,
      matched_user_id = case when p_approve then p_user_id else null end,
      decided_at = now(),
      decided_by = coalesce(v_by, 'admin')
  where id = p_claim_id;
end;
$$;

revoke all on function public.admin_decide_referral_claim(uuid, boolean, uuid) from public, anon;
grant execute on function public.admin_decide_referral_claim(uuid, boolean, uuid) to authenticated;

-- Dashboard: code users (with payouts) + approved claims (tracking only) + claims still being checked.
create or replace function public.my_affiliate_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  with me as (
    select auth.uid() as id
  ),
  my_codes as (
    select rc.id, rc.code, rc.boost_amount, rc.payout_amount, rc.is_active, rc.expires_at, rc.max_uses, rc.current_uses
    from public.referral_codes rc, me
    where me.id is not null and rc.owner_user_id = me.id
  ),
  referred as (
    select u.id, c.id as code_id, c.code, c.payout_amount as code_payout_amount, u.created_at, false as claimed,
      null::text as claimed_name, u.display_name, u.username
    from public.users u
    join my_codes c on c.id = u.redeemed_referral_code_id, me
    where u.id <> me.id
    union all
    -- Claimed friends show the name the owner typed: it's how they know them.
    select u.id, c.id, c.code, 0, u.created_at, true, rcl.friend_name, u.display_name, u.username
    from public.referral_claims rcl
    join my_codes c on c.id = rcl.referral_code_id
    join public.users u on u.id = rcl.matched_user_id, me
    where rcl.status = 'approved' and u.id <> me.id
      and u.redeemed_referral_code_id is distinct from c.id
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
      exists (
        select 1 from public.loans l
        where l.borrower_user_id = r.id
          and l.funded_at is not null
          and l.refunded_at is null
          and not coalesce(l.is_test, false)
      ) as borrowed,
      case when r.claimed then exists (
        select 1 from public.loans l
        where l.borrower_user_id = r.id
          and l.repayment_status = 'Paid'
          and l.refunded_at is null
          and not coalesce(l.is_test, false)
      ) else p.id is not null end as repaid,
      case when r.claimed then 0 else coalesce(p.amount, r.code_payout_amount) end as payout_amount,
      p.status as payout_status,
      p.paid_at
    from referred r
    left join public.referral_code_payouts p on not r.claimed and p.referred_user_id = r.id and p.referral_code_id = r.code_id
  )
  select jsonb_build_object(
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', code,
        'boost_amount', boost_amount,
        'payout_amount', payout_amount,
        'is_active', is_active and (expires_at is null or expires_at > now()) and (max_uses is null or current_uses < max_uses)
      ) order by code)
      from my_codes
    ), '[]'::jsonb),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'first_name', first_name,
        'code', code,
        'joined_at', created_at,
        'claimed', claimed,
        'borrowed', borrowed,
        'repaid', repaid,
        'payout_amount', payout_amount,
        'payout_status', payout_status,
        'paid_at', paid_at
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
      from public.referral_claims rcl, me
      where rcl.owner_user_id = me.id and rcl.status in ('pending', 'rejected')
        and rcl.created_at > now() - interval '30 days'
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.my_affiliate_dashboard() from public, anon;
grant execute on function public.my_affiliate_dashboard() to authenticated;
