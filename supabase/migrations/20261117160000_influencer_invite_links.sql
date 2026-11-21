-- moodeng.app/invite/CODE (and its poster QR) works for influencer codes too (IRISH2026, MAHJID, ...):
-- any active referral_codes row with an owner. The landing page shows the owner's first name, parks the
-- code, and after sign-up redeem_friend_invite links the new account to the code exactly like typing it
-- in the loan form (redeem_referral_code), so the owner earns their payout when this friend repays.

create or replace function public.get_invite_inviter(p_code text)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select split_part(coalesce(nullif(trim(u.display_name), ''), u.username), ' ', 1)
       from public.borrower_invite_codes c
       join public.users u on u.id = c.user_id
      where c.code = upper(trim(p_code))),
    (select split_part(coalesce(nullif(trim(u.display_name), ''), u.username), ' ', 1)
       from public.referral_codes rc
       join public.users u on u.id = rc.owner_user_id
      where rc.code = upper(trim(p_code))
        and rc.is_active
        and (rc.expires_at is null or rc.expires_at > now())
        and (rc.max_uses is null or rc.current_uses < rc.max_uses))
  );
$$;

create or replace function public.redeem_friend_invite(p_code text)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_referrer uuid;
  v_created_at timestamptz;
  v_already boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select user_id into v_referrer from public.borrower_invite_codes where code = v_code;

  -- Not a personal invite code: an influencer's referral code (owned, active).
  if v_referrer is null then
    select owner_user_id into v_referrer from public.referral_codes
     where code = v_code and owner_user_id is not null;
    if v_referrer is null then
      return 'invalid_code';
    end if;
    if v_referrer = v_user_id then
      return 'self_referral';
    end if;
    if exists (select 1 from public.friend_referrals where referred_user_id = v_user_id) then
      return 'already_referred';
    end if;
    select created_at into v_created_at from public.users where id = v_user_id;
    if v_created_at is null or v_created_at < now() - interval '14 days'
       or exists (select 1 from public.loans where borrower_user_id = v_user_id) then
      return 'not_a_new_account';
    end if;
    begin
      select r.already_redeemed into v_already from public.redeem_referral_code(v_code) r;
    exception when others then
      return 'invalid_code';
    end;
    return case when v_already then 'already_referred' else 'joined' end;
  end if;

  if v_referrer = v_user_id then
    return 'self_referral';
  end if;
  if exists (select 1 from public.friend_referrals where referred_user_id = v_user_id) then
    return 'already_referred';
  end if;
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
