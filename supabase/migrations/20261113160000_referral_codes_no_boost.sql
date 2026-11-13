-- Referral codes no longer raise the borrower's credit limit. A code only records who invited them.
-- The old +$5 boost was tied to the $15 start landing on a credit level, which stops making sense as
-- the starting limit changes. Borrowers who already got a boost keep their current limit.

alter table public.referral_codes drop constraint if exists referral_codes_boost_lands_on_tier;
alter table public.referral_codes drop constraint if exists referral_codes_boost_amount_positive;

update public.referral_codes set boost_amount = 0 where boost_amount <> 0;

alter table public.referral_codes alter column boost_amount set default 0;
alter table public.referral_codes
  add constraint referral_codes_boost_amount_zero check (boost_amount = 0);

-- Same as before, but the borrower's limit (cs) is left alone and the recorded boost is 0.
create or replace function public.redeem_referral_code(code_input text)
returns table(id uuid, code text, boost_amount numeric, previous_limit numeric, new_limit numeric, already_redeemed boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
