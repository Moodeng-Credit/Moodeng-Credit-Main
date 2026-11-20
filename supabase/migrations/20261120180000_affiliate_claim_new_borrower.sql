-- claim_affiliate_invite: also turn a brand-new "borrower" (set during sign-up) into an affiliate.
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

  -- New accounts become affiliates: no role yet, or a "borrower" set during sign-up (under a day old,
  -- no loans, never asked for loan access). Real borrowers and lenders keep their role.
  update public.users u
     set user_role = 'affiliate', prescreen_path = false
   where u.id = uid
     and (u.user_role is null
          or (u.user_role = 'borrower'
              and u.created_at > now() - interval '1 day'
              and coalesce(u.loan_access_status::text, 'none') = 'none'
              and not exists (select 1 from public.loans l where l.borrower_user_id = u.id)
              and not exists (select 1 from public.loan_access_requests r where r.user_id = u.id)));

  select user_role into v_role from public.users where id = uid;
  return jsonb_build_object('code', v_rc.code, 'role', v_role);
end;
$$;
revoke all on function public.claim_affiliate_invite(text) from public, anon;
grant execute on function public.claim_affiliate_invite(text) to authenticated;
