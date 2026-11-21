-- One inviter per person (found 2026-11-21 while checking the new "Who invited you?" screen).
-- A personal invite (friend_referrals) and a team/affiliate code (users.redeemed_referral_code_id)
-- were checked separately, so one person could be credited to both and both inviters paid; one
-- live account already was. Each redeem now refuses when the other kind is already there.
-- Bodies are the live definitions with only the new checks added.

CREATE OR REPLACE FUNCTION public.redeem_friend_invite(p_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  -- Already credited to a team/affiliate code: one inviter per person, so nobody is paid twice.
  if exists (select 1 from public.users where id = v_user_id and redeemed_referral_code_id is not null) then
    return 'already_referred';
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
$function$;

CREATE OR REPLACE FUNCTION public.redeem_referral_code(code_input text)
 RETURNS TABLE(id uuid, code text, boost_amount numeric, previous_limit numeric, new_limit numeric, already_redeemed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  clean_code text := upper(trim(code_input));
  current_user_id uuid := auth.uid();
  referral_row public.referral_codes%rowtype;
  user_row public.users%rowtype;
  limit_value numeric;
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if clean_code is null or clean_code = '' then
    raise exception 'Referral code required' using errcode = '22023';
  end if;

  select * into user_row from public.users where public.users.id = current_user_id for update;

  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  limit_value := coalesce(user_row.cs, 0);

  if user_row.redeemed_referral_code_id is not null then
    select * into referral_row from public.referral_codes
    where public.referral_codes.id = user_row.redeemed_referral_code_id;

    if not found then
      raise exception 'Redeemed referral code not found' using errcode = 'P0002';
    end if;

    return query select referral_row.id, referral_row.code, 0::numeric, limit_value, limit_value, true;
    return;
  end if;

  -- Already credited to a friend's personal invite: one inviter per person, so nobody is paid twice.
  if exists (select 1 from public.friend_referrals fr where fr.referred_user_id = current_user_id) then
    raise exception 'Your account already has a friend who invited you.' using errcode = 'P0001';
  end if;

  select * into referral_row
  from public.referral_codes
  where public.referral_codes.code = clean_code
    and public.referral_codes.is_active = true
    and (public.referral_codes.expires_at is null or public.referral_codes.expires_at > now())
    and (public.referral_codes.max_uses is null or public.referral_codes.current_uses < public.referral_codes.max_uses)
  for update;

  if not found then
    raise exception 'Referral code incorrect. If you have issues, contact support.' using errcode = 'P0001';
  end if;

  update public.users
  set
    redeemed_referral_code_id = referral_row.id,
    referral_boost_amount = 0,
    updated_at = now()
  where public.users.id = current_user_id;

  update public.referral_codes
  set
    current_uses = public.referral_codes.current_uses + 1,
    updated_at = now()
  where public.referral_codes.id = referral_row.id;

  return query select referral_row.id, referral_row.code, 0::numeric, limit_value, limit_value, false;
end;
$function$;
