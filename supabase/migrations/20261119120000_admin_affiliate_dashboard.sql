-- Admins can open any affiliate's dashboard (asked by George 2026-11-19: "I should be allowed to see Mahjid's one").
-- The body of my_affiliate_dashboard() moves, unchanged, into app_private.affiliate_dashboard_for(user id);
-- my_affiliate_dashboard() keeps doing exactly what it did for the signed-in person, and
-- admin_affiliate_dashboard(who) returns the same thing for any user (uuid or @username), admins only, read-only.

create or replace function app_private.affiliate_dashboard_for(v_me uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if v_me is null then
    return jsonb_build_object('codes', '[]'::jsonb, 'referrals', '[]'::jsonb, 'claims', '[]'::jsonb);
  end if;
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
      null::text as claimed_name, u.display_name, u.username, false as personal, null::uuid as friend_referral_id,
      null::text as claimed_facebook_url
    from public.users u
    join my_codes c on c.id = u.redeemed_referral_code_id
    where u.id <> v_me
    union all
    select u.id, c.id, c.code, 0, u.created_at, true, rcl.friend_name, u.display_name, u.username, false, null,
      rcl.friend_facebook_url
    from public.referral_claims rcl
    join my_codes c on c.id = rcl.referral_code_id
    join public.users u on u.id = rcl.matched_user_id
    where rcl.status = 'approved' and u.id <> v_me
      and u.redeemed_referral_code_id is distinct from c.id
    union all
    -- Personal invite code (link, typed code, or a hand-added friend the team approved).
    select u.id, null, fr.code, 5, fr.created_at, not fr.payout_eligible, rcl.friend_name, u.display_name, u.username, true, fr.id,
      rcl.friend_facebook_url
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
      -- So the referrer can tell who this is (the person they invited) and answer them without asking us.
      nullif(trim(r.display_name), '') as full_name,
      nullif(trim(r.username), '') as username,
      nullif(trim(fu.facebook_name), '') as facebook_name,
      coalesce(
        case when fu.facebook_profile_url ~* '^https?://([a-z0-9-]+\.)?(facebook|fb)\.com/' then fu.facebook_profile_url end,
        case when fu.facebook_contact ~* '^https?://([a-z0-9-]+\.)?(facebook|fb)\.com/' then fu.facebook_contact end,
        case when r.claimed_facebook_url ~* '^https?://([a-z0-9-]+\.)?(facebook|fb)\.com/' then r.claimed_facebook_url end
      ) as facebook_url,
      fu.loan_access_status::text as access,
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
    join public.users fu on fu.id = r.id
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
        'full_name', full_name,
        'username', username,
        'facebook_name', facebook_name,
        'facebook_url', facebook_url,
        'access', access,
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

revoke all on function app_private.affiliate_dashboard_for(uuid) from public, anon, authenticated;

create or replace function public.my_affiliate_dashboard()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return jsonb_build_object('codes', '[]'::jsonb, 'referrals', '[]'::jsonb, 'claims', '[]'::jsonb);
  end if;
  -- Every borrower has a personal code; make it on first visit.
  perform public.get_my_invite_code();
  return app_private.affiliate_dashboard_for(v_me);
end;
$$;

revoke all on function public.my_affiliate_dashboard() from public, anon;
grant execute on function public.my_affiliate_dashboard() to authenticated;

-- who = a user id or a username (with or without @). Returns the dashboard plus who it belongs to.
create or replace function public.admin_affiliate_dashboard(p_who text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_who text := lower(trim(both from ltrim(trim(coalesce(p_who, '')), '@')));
  v_user public.users%rowtype;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if v_who ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select * into v_user from public.users where id = v_who::uuid;
  else
    select * into v_user from public.users where lower(username) = v_who order by created_at limit 1;
  end if;
  if v_user.id is null then
    raise exception 'No user found for %', p_who using errcode = 'P0002';
  end if;
  return app_private.affiliate_dashboard_for(v_user.id) || jsonb_build_object(
    'viewing', jsonb_build_object(
      'id', v_user.id,
      'username', v_user.username,
      'display_name', v_user.display_name
    )
  );
end;
$$;

revoke all on function public.admin_affiliate_dashboard(text) from public, anon;
grant execute on function public.admin_affiliate_dashboard(text) to authenticated;
