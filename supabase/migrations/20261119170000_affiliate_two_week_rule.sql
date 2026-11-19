-- Affiliate rule (George, 2026-11-19): a friend's repayment earns the inviter money only if it is paid in
-- the last 2 weeks before the loan's due date. Paying a 30-day loan back in the first 2 weeks is gaming the
-- program (borrow, repay fast, collect the referral), not using the loan. The 48-hour floor still applies,
-- so a 14-day loan counts from day 2.
--
-- Only the affiliate side changes. Credit level-ups, food vouchers and the affiliate's own unlock
-- (is_affiliate) keep loan_counts_for_rewards (48h).
--   * loan_counts_for_affiliate: new test.
--   * queue_interest_refunds (personal-code $5), get_my_interest_refunds, the team-code payout trigger and
--     affiliate_dashboard_for use it. Payouts already sent or taken as a voucher stay.

create or replace function app_private.loan_counts_for_affiliate(p_loan public.loans)
returns boolean
language sql
stable
set search_path to ''
as $function$
  select app_private.loan_counts_for_rewards(p_loan)
    and (
      p_loan.due_date is null
      or coalesce(p_loan.repaid_at, p_loan.updated_at)
         >= app_private.loan_day_end((p_loan.due_date at time zone 'UTC')::date, p_loan.due_timezone) - interval '15 days'
    );
$function$;

revoke all on function app_private.loan_counts_for_affiliate(public.loans) from public, anon, authenticated;

create or replace function app_private.queue_interest_refunds(p_inviter uuid)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
        and app_private.loan_counts_for_affiliate(fl)
    )
  order by r.created_at
  on conflict do nothing;

  get diagnostics v_queued = row_count;
  return v_queued;
end;
$function$;

create or replace function public.get_my_interest_refunds()
returns jsonb
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  with me as (select auth.uid() as id),
  friends as (
    select r.id, r.created_at,
      exists (
        select 1 from public.loans fl
        where fl.borrower_user_id = r.referred_user_id
          and fl.lender_user_id is distinct from r.referrer_user_id
          and app_private.is_fully_repaid_loan(fl)
          and app_private.loan_counts_for_affiliate(fl)
      ) as repaid
    from public.friend_referrals r, me
    where r.referrer_user_id = me.id
  )
  select jsonb_build_object(
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'joinedAt', f.created_at,
        'repaid', f.repaid,
        'refundUsd', ir.amount_usd,
        'refundStatus', ir.status,
        'kind', ir.kind,
        'sentAt', ir.sent_at,
        'txHash', ir.tx_hash
      ) order by f.created_at desc)
      from friends f
      left join public.interest_refunds ir on ir.friend_referral_id = f.id
    ), '[]'::jsonb),
    'totalRefundedUsd', coalesce((select sum(amount_usd) from public.interest_refunds, me where user_id = me.id and status = 'sent'), 0),
    'totalEarnedUsd', coalesce((select sum(amount_usd) from public.interest_refunds, me where user_id = me.id and status = 'sent'), 0),
    'owedUsd', coalesce((select sum(amount_usd) from public.interest_refunds, me where user_id = me.id and status = 'pending'), 0),
    'isAffiliate', coalesce((select app_private.is_affiliate(me.id) from me), false),
    'rewardUsd', 5
  );
$function$;

create or replace function private.create_referral_code_payout_on_repayment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rc public.referral_codes%rowtype;
begin
  if new.repayment_status is distinct from 'Paid'
     or new.refunded_at is not null
     or coalesce(new.is_test, false)
     or new.funded_at is null
     or now() - new.funded_at < interval '24 hours'
     or not app_private.loan_counts_for_affiliate(new)
     or not (case
          when coalesce(new.total_repayment_amount, 0) > 0 then coalesce(new.repaid_amount, 0) >= new.total_repayment_amount
          else coalesce(new.repaid_amount, 0) > 0
        end) then
    return new;
  end if;

  select r.* into rc
  from public.users u
  join public.referral_codes r on r.id = u.redeemed_referral_code_id
  where u.id = new.borrower_user_id;

  if not found
     or rc.owner_user_id is null
     or rc.owner_user_id = new.borrower_user_id
     or rc.owner_user_id is not distinct from new.lender_user_id then
    return new;
  end if;

  insert into public.referral_code_payouts (referral_code_id, code, owner_user_id, referred_user_id)
  values (rc.id, rc.code, rc.owner_user_id, new.borrower_user_id)
  on conflict (referral_code_id, referred_user_id) do nothing;
  return new;
end;
$function$;

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
        -- A $5 that is already settled stays; an unpaid one needs a loan repaid in its last 2 weeks (loan_counts_for_affiliate).
        when r.personal then coalesce(ir.status in ('sent', 'voucher'), false) or exists (
          select 1 from public.loans l
          where l.borrower_user_id = r.id
            and l.lender_user_id is distinct from v_me
            and not coalesce(l.is_test, false)
            and app_private.is_fully_repaid_loan(l)
            and app_private.loan_counts_for_affiliate(l)
        )
        when r.claimed then exists (
          select 1 from public.loans l
          where l.borrower_user_id = r.id
            and l.repayment_status = 'Paid'
            and l.refunded_at is null
            and not coalesce(l.is_test, false)
        )
        else p.id is not null and (
          p.status is distinct from 'unpaid' or exists (
            select 1 from public.loans l
            where l.borrower_user_id = r.id
              and not coalesce(l.is_test, false)
              and app_private.is_fully_repaid_loan(l)
              and app_private.loan_counts_for_affiliate(l)
          )
        )
      end as repaid,
      -- Repaid, but every repaid loan was paid off more than 2 weeks before it was due — shown as "Repaid too early".
      not r.claimed and exists (
        select 1 from public.loans l
        where l.borrower_user_id = r.id
          and l.lender_user_id is distinct from v_me
          and not coalesce(l.is_test, false)
          and app_private.is_fully_repaid_loan(l)
          and not app_private.loan_counts_for_affiliate(l)
      ) as repaid_early,
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
        'repaid_too_early', repaid_early and not repaid,
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
