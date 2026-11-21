-- Call sheet "Referred by" dropdown (Irish / Mahjid): links the borrower to that influencer's code so the
-- influencer earns their payout when the friend repays. Admin only. Never moves someone whose friend
-- payout already exists, and sends no "code used" alert (alerted_at set).
create or replace function public.admin_link_referral(p_user_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.referral_codes%rowtype;
  v_current uuid;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admin only';
  end if;

  select * into v_code from public.referral_codes where upper(code) = upper(trim(p_code));
  if not found then
    raise exception 'unknown code %', p_code;
  end if;
  if v_code.owner_user_id = p_user_id then
    raise exception 'that is their own code';
  end if;

  select redeemed_referral_code_id into v_current from public.users where id = p_user_id;
  if not found then
    raise exception 'unknown user';
  end if;
  if v_current = v_code.id then
    return v_code.code;
  end if;
  if exists (select 1 from public.referral_code_payouts where referred_user_id = p_user_id) then
    raise exception 'already earned a payout for another code';
  end if;

  update public.users set redeemed_referral_code_id = v_code.id where id = p_user_id;
  if v_current is not null then
    update public.referral_codes set current_uses = greatest(current_uses - 1, 0) where id = v_current;
  end if;
  update public.referral_codes set current_uses = current_uses + 1 where id = v_code.id;
  insert into public.referral_redemptions (user_id, referral_code_id, code, alerted_at)
  values (p_user_id, v_code.id, v_code.code, now())
  on conflict (user_id) do update set referral_code_id = excluded.referral_code_id, code = excluded.code;
  return v_code.code;
end;
$$;

revoke all on function public.admin_link_referral(uuid, text) from public, anon;
grant execute on function public.admin_link_referral(uuid, text) to authenticated;
