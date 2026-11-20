-- Affiliate-only sign-up link (moodeng.app/partner/TOKEN).
--
-- An affiliate (an influencer / promoter the team recruits, e.g. Angelie) used to have to sign up as a
-- borrower and then get linked to a code by hand on /admin. Now the team makes a one-time link for a
-- referral code; whoever opens it and signs up becomes that code's owner with user_role = 'affiliate'.
-- 'affiliate' skips every borrower step (Facebook, pre-screening, intro call, KYC) the same way
-- 'lender' does, and lands on /affiliate. They still get a Moodeng wallet, since payouts go there.
--
-- Someone who already has an account (borrower or lender) can open the link too: they become the
-- code's owner and keep their role.

create table if not exists public.affiliate_invites (
  token text primary key,
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  created_by uuid null,
  created_at timestamptz not null default now(),
  claimed_by uuid null references public.users(id) on delete set null,
  claimed_at timestamptz null
);
create index if not exists affiliate_invites_code_idx on public.affiliate_invites (referral_code_id);
-- Tokens are the key: no direct table access, only the functions below.
alter table public.affiliate_invites enable row level security;
revoke all on public.affiliate_invites from anon, authenticated;

-- Admin: make (or reuse) the open sign-up link for a code. Creates the code ($5 per friend, team-made)
-- if it doesn't exist yet. Refuses a code someone already owns.
create or replace function public.admin_create_affiliate_invite(p_code text, p_label text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_row public.referral_codes%rowtype;
  v_token text;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admin only';
  end if;
  if v_code !~ '^[A-Z0-9]{3,20}$' then
    raise exception 'code must be 3-20 letters or numbers';
  end if;

  select * into v_row from public.referral_codes where upper(code) = v_code;
  if not found then
    insert into public.referral_codes (code, label, channel, payout_amount)
    values (v_code, nullif(btrim(coalesce(p_label, '')), ''), 'person', 5)
    returning * into v_row;
  end if;
  if v_row.owner_user_id is not null then
    raise exception 'code % already has an owner', v_row.code;
  end if;

  select token into v_token from public.affiliate_invites
   where referral_code_id = v_row.id and claimed_by is null
   order by created_at desc limit 1;
  if v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '');
    insert into public.affiliate_invites (token, referral_code_id, created_by) values (v_token, v_row.id, auth.uid());
  end if;
  return v_token;
end;
$$;
revoke all on function public.admin_create_affiliate_invite(text, text) from public, anon;
grant execute on function public.admin_create_affiliate_invite(text, text) to authenticated;

-- Public: what the /partner page shows before sign-up. Never returns who claimed it.
create or replace function public.affiliate_invite_info(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'code', rc.code,
    'label', rc.label,
    'payout', rc.payout_amount,
    'claimed', i.claimed_by is not null or (rc.owner_user_id is not null and rc.owner_user_id is distinct from auth.uid()),
    'mine', auth.uid() is not null and (i.claimed_by = auth.uid() or rc.owner_user_id = auth.uid())
  )
  from public.affiliate_invites i
  join public.referral_codes rc on rc.id = i.referral_code_id
  where i.token = btrim(coalesce(p_token, ''));
$$;
revoke all on function public.affiliate_invite_info(text) from public;
grant execute on function public.affiliate_invite_info(text) to anon, authenticated;

-- Signed in: take the code. New accounts (no role yet) become 'affiliate' and leave the borrower
-- pre-screening path. Returns { code, role }.
create or replace function public.claim_affiliate_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_inv public.affiliate_invites%rowtype;
  v_rc public.referral_codes%rowtype;
  v_role text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select * into v_inv from public.affiliate_invites where token = btrim(coalesce(p_token, '')) for update;
  if not found then
    raise exception 'invite_not_found';
  end if;
  select * into v_rc from public.referral_codes where id = v_inv.referral_code_id for update;

  if (v_inv.claimed_by is not null and v_inv.claimed_by <> uid)
     or (v_rc.owner_user_id is not null and v_rc.owner_user_id <> uid) then
    raise exception 'invite_already_claimed';
  end if;
  -- Your own code can't be one you signed up with.
  if exists (select 1 from public.users where id = uid and redeemed_referral_code_id = v_rc.id) then
    raise exception 'invite_own_code';
  end if;

  update public.referral_codes set owner_user_id = uid, updated_at = now() where id = v_rc.id;
  update public.affiliate_invites set claimed_by = uid, claimed_at = coalesce(claimed_at, now()) where token = v_inv.token;

  update public.users
     set user_role = 'affiliate', prescreen_path = false
   where id = uid and user_role is null;

  select user_role into v_role from public.users where id = uid;
  return jsonb_build_object('code', v_rc.code, 'role', v_role);
end;
$$;
revoke all on function public.claim_affiliate_invite(text) from public, anon;
grant execute on function public.claim_affiliate_invite(text) to authenticated;

-- Affiliates never meet the pre-KYC gate or the pre-screening path (same as lenders).
create or replace function public.needs_pre_kyc_gate(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT public.get_kyc_gate()
     AND u.market IS DISTINCT FROM 'ID'
     AND coalesce(u.user_role, '') NOT IN ('lender', 'affiliate')
     AND u.is_didit IS DISTINCT FROM 'ACTIVE'
     AND u.is_world_id IS DISTINCT FROM 'ACTIVE'
     AND (to_jsonb(u) ->> 'is_world_id_passport') IS DISTINCT FROM 'ACTIVE'
     AND u.loan_access_status IS DISTINCT FROM 'approved'
     AND NOT EXISTS (SELECT 1 FROM public.loans l WHERE l.borrower_user_id = u.id AND l.funded_at IS NOT NULL)
     AND lower(coalesce(u.didit_id_status, '')) IS DISTINCT FROM 'duplicate'
     AND NOT (lower(coalesce(u.didit_id_status, '')) LIKE '%review%'
              OR (u.didit_submitted_at IS NOT NULL
                  AND lower(coalesce(u.didit_id_status, '')) NOT IN
                      ('duplicate', 'declined', 'abandoned', 'expired', 'not started', 'in progress')))
  FROM public.users u
  WHERE u.id = p_user_id;
$function$;

create or replace function public.join_prescreen_path()
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  if not coalesce(public.needs_pre_kyc_gate(uid), false) then return false; end if;
  update public.users set prescreen_path = true
   where id = uid and coalesce(user_role, '') not in ('lender', 'affiliate') and created_at > now() - interval '7 days'
     and not prescreen_path;
  return exists (select 1 from public.users where id = uid and prescreen_path);
end;
$function$;
