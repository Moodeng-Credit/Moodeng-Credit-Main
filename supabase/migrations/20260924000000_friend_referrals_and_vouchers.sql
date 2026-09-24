-- Friend-to-friend referrals ("FREE MEAL for both of you") and GrabFood voucher claims.
--
-- Separate from public.referral_codes, which are admin-made promo codes that boost a loan request.
-- Follows the security runbook: the browser only calls the functions below; every table is written
-- exclusively by SECURITY DEFINER functions that re-check eligibility server-side.
--
-- Rewards (from the dashboard design):
--   first_on_time_repayment  ₱50   borrower's own first on-time repayment
--   referral_inviter         ₱100  per invited friend, once that friend repays a loan on time
--   referral_invitee         ₱100  the invited friend, once they repay a loan on time
--
-- "On time" matches src/lib/creditLeveling.ts isRepaidOnTime: fully repaid, not refunded, and paid
-- before due_date + 24h.

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------

create table if not exists public.borrower_invite_codes (
  user_id uuid primary key references public.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now(),
  constraint borrower_invite_codes_format check (code ~ '^[A-Z]{6}[0-9]{5}$')
);

create table if not exists public.friend_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.users(id) on delete cascade,
  referred_user_id uuid not null unique references public.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  constraint friend_referrals_not_self check (referrer_user_id <> referred_user_id)
);

create index if not exists idx_friend_referrals_referrer on public.friend_referrals (referrer_user_id);

create table if not exists public.voucher_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reward text not null,
  friend_referral_id uuid references public.friend_referrals(id) on delete set null,
  amount_php numeric(10, 2) not null,
  full_name text not null,
  mobile text not null,
  email text,
  status text not null default 'pending',
  admin_note text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voucher_claims_reward check (reward in ('first_on_time_repayment', 'referral_inviter', 'referral_invitee')),
  constraint voucher_claims_status check (status in ('pending', 'sent', 'rejected')),
  constraint voucher_claims_amount_positive check (amount_php > 0),
  constraint voucher_claims_full_name_length check (char_length(full_name) between 2 and 120),
  constraint voucher_claims_mobile_format check (mobile ~ '^\+?[0-9][0-9 ()-]{6,19}$'),
  constraint voucher_claims_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Referral claims keep their history (friend_referral_id becomes null) if the other person deletes their account.
  constraint voucher_claims_referral_link check (reward <> 'first_on_time_repayment' or friend_referral_id is null)
);

-- One live claim per reward: the own voucher once, each referral side once. A rejected claim (e.g. a
-- mistyped GCash number) does not count, so the borrower can submit again.
drop index if exists public.voucher_claims_one_per_reward;
create unique index if not exists voucher_claims_own_once
  on public.voucher_claims (user_id)
  where reward = 'first_on_time_repayment' and status <> 'rejected';
create unique index if not exists voucher_claims_referral_once
  on public.voucher_claims (user_id, reward, friend_referral_id)
  where friend_referral_id is not null and status <> 'rejected';

drop trigger if exists update_voucher_claims_updated_at on public.voucher_claims;
create trigger update_voucher_claims_updated_at before update on public.voucher_claims
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------------------------
-- Row level security: read your own rows; admins read everything and manage claim status.
-- No insert/update/delete policies for borrowers — writes go through the functions below.
-- ---------------------------------------------------------------------------------------------

alter table public.borrower_invite_codes enable row level security;
alter table public.friend_referrals enable row level security;
alter table public.voucher_claims enable row level security;

drop policy if exists "Borrowers read their invite code" on public.borrower_invite_codes;
create policy "Borrowers read their invite code" on public.borrower_invite_codes
  for select to authenticated using (user_id = auth.uid() or app_private.is_moodeng_admin());

drop policy if exists "Borrowers read their referrals" on public.friend_referrals;
create policy "Borrowers read their referrals" on public.friend_referrals
  for select to authenticated
  using (referrer_user_id = auth.uid() or referred_user_id = auth.uid() or app_private.is_moodeng_admin());

drop policy if exists "Borrowers read their voucher claims" on public.voucher_claims;
create policy "Borrowers read their voucher claims" on public.voucher_claims
  for select to authenticated using (user_id = auth.uid() or app_private.is_moodeng_admin());

drop policy if exists "Admins update voucher claims" on public.voucher_claims;
create policy "Admins update voucher claims" on public.voucher_claims
  for update to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

revoke insert, update, delete on public.borrower_invite_codes from anon, authenticated;
revoke insert, update, delete on public.friend_referrals from anon, authenticated;
revoke insert, delete on public.voucher_claims from anon, authenticated;
revoke update on public.voucher_claims from anon, authenticated;
grant select on public.borrower_invite_codes, public.friend_referrals, public.voucher_claims to authenticated;
-- Admins may only change the fulfilment columns, never who/what was claimed.
grant update (status, admin_note, sent_at) on public.voucher_claims to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------

-- p_exclude_lender: for referral rewards, a loan funded by the inviter does not count (stops an
-- inviter from funding and "earning" their own referral bonus). Test loans never count.
create or replace function app_private.has_on_time_repayment(p_user_id uuid, p_exclude_lender uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
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
      and coalesce(l.repaid_at, l.updated_at) < l.due_date + interval '24 hours'
  );
$$;

create or replace function app_private.generate_invite_code()
returns text
language sql
volatile
set search_path = public, pg_temp
as $$
  select string_agg(chr(65 + floor(random() * 26)::int), '') || lpad(floor(random() * 100000)::int::text, 5, '0')
  from generate_series(1, 6);
$$;

-- ---------------------------------------------------------------------------------------------
-- Borrower-facing functions
-- ---------------------------------------------------------------------------------------------

-- Returns the caller's invite code, creating it on first use.
create or replace function public.get_my_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_attempt int := 0;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select code into v_code from public.borrower_invite_codes where user_id = v_user_id;
  if v_code is not null then
    return v_code;
  end if;

  loop
    v_attempt := v_attempt + 1;
    insert into public.borrower_invite_codes (user_id, code)
    values (v_user_id, app_private.generate_invite_code())
    on conflict do nothing;

    select code into v_code from public.borrower_invite_codes where user_id = v_user_id;
    exit when v_code is not null or v_attempt >= 10;
  end loop;

  if v_code is null then
    raise exception 'could not allocate an invite code';
  end if;
  return v_code;
end;
$$;

-- Public: first name of the inviter for the invite landing page (nothing else is exposed).
create or replace function public.get_invite_inviter(p_code text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select split_part(coalesce(nullif(trim(u.display_name), ''), u.username), ' ', 1)
  from public.borrower_invite_codes c
  join public.users u on u.id = c.user_id
  where c.code = upper(trim(p_code));
$$;

-- Links the caller (a new account) to the owner of p_code. Returns a status string.
create or replace function public.redeem_friend_invite(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_referrer uuid;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select user_id into v_referrer from public.borrower_invite_codes where code = v_code;
  if v_referrer is null then
    return 'invalid_code';
  end if;
  if v_referrer = v_user_id then
    return 'self_referral';
  end if;
  if exists (select 1 from public.friend_referrals where referred_user_id = v_user_id) then
    return 'already_referred';
  end if;
  -- No circular pairs: the person who invited you cannot also be invited by you.
  if exists (select 1 from public.friend_referrals where referrer_user_id = v_user_id and referred_user_id = v_referrer) then
    return 'self_referral';
  end if;

  select created_at into v_created_at from public.users where id = v_user_id;
  if v_created_at is null or v_created_at < now() - interval '14 days'
     or exists (select 1 from public.loans where borrower_user_id = v_user_id) then
    return 'not_a_new_account';
  end if;

  insert into public.friend_referrals (referrer_user_id, referred_user_id, code)
  values (v_referrer, v_user_id, v_code)
  on conflict (referred_user_id) do nothing;
  return 'joined';
end;
$$;

-- Everything the rewards UI needs, computed server-side.
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
    select c.reward, c.friend_referral_id, c.status, c.created_at from public.voucher_claims c, me where c.user_id = me.id
  ),
  eligible as (
    select 'first_on_time_repayment'::text as reward, null::uuid as friend_referral_id, 50::numeric as amount_php
    from me where app_private.has_on_time_repayment(me.id)
    union all
    select 'referral_invitee', rb.id, 100 from referred_by rb, me where app_private.has_on_time_repayment(me.id, rb.referrer_user_id)
    union all
    select 'referral_inviter', i.id, 100 from invited i where i.qualified
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

-- Files a voucher claim after re-checking eligibility. Returns the claim id.
create or replace function public.submit_voucher_claim(
  p_reward text,
  p_friend_referral_id uuid,
  p_full_name text,
  p_mobile text,
  p_email text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_amount numeric;
  v_eligible boolean;
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

revoke all on function public.get_my_invite_code() from public;
revoke all on function public.get_invite_inviter(text) from public;
revoke all on function public.redeem_friend_invite(text) from public;
revoke all on function public.get_my_rewards() from public;
revoke all on function public.submit_voucher_claim(text, uuid, text, text, text) from public;
revoke all on function app_private.has_on_time_repayment(uuid, uuid) from public;
revoke all on function app_private.generate_invite_code() from public;

grant execute on function public.get_my_invite_code() to authenticated;
grant execute on function public.get_invite_inviter(text) to anon, authenticated;
grant execute on function public.redeem_friend_invite(text) to authenticated;
grant execute on function public.get_my_rewards() to authenticated;
grant execute on function public.submit_voucher_claim(text, uuid, text, text, text) to authenticated;
