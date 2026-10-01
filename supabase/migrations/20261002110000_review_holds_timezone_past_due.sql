-- Review of #1028-#1030 (2026-10-02).
--
-- 1) A borrower currently marked no-show (they haven't rebooked: a Cal.com booking resets the
--    outcome) gets any NEW request held too. Before, deleting a held request and posting again put
--    a visible, fundable request straight back on the board.
-- 2) resolve_user_timezone: a brand-new borrower has fewer than 3 logins, so no "usual country" and
--    their device zone was trusted outright. The 3-hour check now falls back to the country of their
--    most recent login.
-- 3) One "past due" moment for SQL, same as the app (src/utils/loanOverdue.ts getLoanPastDueAt):
--    the later of due_date + 24h and the end of the due day in the loan's zone. The
--    trusted-borrower milestone's "unresolved default" uses it instead of midnight UTC.

create or replace function app_private.loan_past_due_at(p_loan public.loans)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select greatest(
    p_loan.due_date + interval '24 hours',
    (((p_loan.due_date at time zone 'UTC')::date + 1)::timestamp
      at time zone (case when app_private.is_usable_timezone(p_loan.due_timezone) then p_loan.due_timezone else 'Asia/Manila' end))
  );
$$;

create or replace function app_private.hold_request_until_first_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outcome text;
  v_referred boolean;
begin
  if new.loan_status <> 'Requested' or new.borrower_user_id is null or public.get_loan_flow() <> 'open' then
    return new;
  end if;
  -- CONTACT_STEP_EXEMPT_USER_IDS in src/config/contactVerification.ts
  if new.borrower_user_id in ('28cd3b3e-a975-48ab-9db3-a23f74c01d42', 'a629dfa3-ebe0-4365-b267-294b19a6ead1') then
    return new;
  end if;

  select u.video_call_outcome::text, u.redeemed_referral_code_id is not null
    into v_outcome, v_referred
    from public.users as u
   where u.id = new.borrower_user_id;

  -- Unreferred and never funded: off the board until they attend a call.
  if not coalesce(v_referred, false)
     and coalesce(v_outcome, '') <> 'attended'
     and not exists (
       select 1 from public.loans as l where l.borrower_user_id = new.borrower_user_id and l.funded_at is not null
     ) then
    new.on_hold_since := now();
    new.on_hold_reason := 'awaiting_call';
  -- Anyone else who missed their call and hasn't rebooked: held until they book a new call.
  elsif v_outcome = 'no_show' then
    new.on_hold_since := now();
    new.on_hold_reason := 'no_show';
  end if;
  return new;
end;
$$;

create or replace function app_private.resolve_user_timezone(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_device text;
  v_call text;
  v_country text;
  v_country_zone text;
  v_check_zone text;
  v_claimed text;
begin
  select u.timezone, u.video_call_timezone into v_device, v_call from public.users as u where u.id = p_user_id;

  select l.country_iso into v_country
  from public.auth_ip_log as l
  where l.user_id = p_user_id and l.country_iso is not null and not coalesce(l.is_hosting, false)
  group by l.country_iso
  having count(*) >= 3
  order by count(*) desc, max(l.last_seen_at) desc
  limit 1;
  v_country_zone := app_private.country_timezone(v_country);

  -- For the 3-hour check only: a new borrower has no usual country yet, so use their latest login's.
  v_check_zone := v_country_zone;
  if v_check_zone is null then
    select app_private.country_timezone(l.country_iso) into v_check_zone
    from public.auth_ip_log as l
    where l.user_id = p_user_id and l.country_iso is not null and not coalesce(l.is_hosting, false)
    order by l.last_seen_at desc
    limit 1;
  end if;

  v_claimed := case
    when app_private.is_usable_timezone(v_device) then v_device
    when app_private.is_usable_timezone(v_call) then v_call
  end;

  if v_claimed is not null
     and (v_check_zone is null
          or abs(extract(epoch from (now() at time zone v_claimed) - (now() at time zone v_check_zone))) <= 3 * 3600) then
    return v_claimed;
  end if;

  return coalesce(v_country_zone, v_check_zone, 'Asia/Manila');
end;
$$;

create or replace function private.is_trust_milestone_complete(
  user_id_input uuid,
  milestone_id_input text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  on_time_paid_count integer := 0;
  funded_count integer := 0;
  unique_lender_count integer := 0;
  total_repaid numeric := 0;
  has_unresolved_default boolean := false;
  credit_limit integer := 0;
  replay_limit integer := 15;
  paid_loan public.loans;
  is_verified boolean := false;
begin
  select
    coalesce(u.cs, 0),
    coalesce(
      u.is_world_id::text = 'ACTIVE'
      or u.is_didit::text = 'ACTIVE',
      false
    )
  into credit_limit, is_verified
  from public.users as u
  where u.id = user_id_input;

  select count(*)::integer
  into funded_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.loan_status = 'Lent';

  select count(*)::integer
  into on_time_paid_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and app_private.is_loan_repaid_on_time(l);

  select count(distinct l.lender_user_id)::integer
  into unique_lender_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.loan_status = 'Lent'
    and l.lender_user_id is not null;

  select coalesce(sum(coalesce(l.repaid_amount, 0)), 0)
  into total_repaid
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and app_private.is_loan_fully_repaid(l);

  select exists (
    select 1
    from public.loans as l
    where l.borrower_user_id = user_id_input
      and l.loan_status = 'Lent'
      and coalesce(l.repayment_status::text, 'Unpaid') <> 'Paid'
      and now() >= app_private.loan_past_due_at(l)
  )
  into has_unresolved_default;

  if milestone_id_input = 'verify-identity' then
    return is_verified;
  elsif milestone_id_input = 'first-loan-request' then
    return exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
    );
  elsif milestone_id_input = 'first-funded-loan' then
    return funded_count >= 1;
  elsif milestone_id_input = 'first-on-time-repayment' then
    return on_time_paid_count >= 1;
  elsif milestone_id_input = 'two-on-time-streak' then
    return on_time_paid_count >= 2;
  elsif milestone_id_input = 'full-limit-credit-builder' then
    -- Recorded at repayment (confirm-loan-payment): principal at or above the limit the borrower
    -- had at that moment, repaid on time.
    if exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.credit_limit_at_repayment is not null
        and l.loan_amount >= l.credit_limit_at_repayment
        and app_private.is_loan_repaid_on_time(l)
    ) then
      return true;
    end if;
    -- Loans repaid before that was recorded: replay the level-up rule over them, from $15.
    for paid_loan in
      select l.*
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.credit_limit_at_repayment is null
        and app_private.is_loan_fully_repaid(l)
      order by coalesce(l.repaid_at, l.updated_at), l.id
    loop
      if paid_loan.loan_amount >= replay_limit then
        if app_private.is_loan_repaid_on_time(paid_loan) then
          return true;
        end if;
        select coalesce(min(t), 140) into replay_limit
        from unnest(array[15, 20, 40, 60, 80, 100, 120, 140]) as t
        where t > replay_limit;
      end if;
    end loop;
    return false;
  elsif milestone_id_input = 'two-unique-lenders' then
    return unique_lender_count >= 2;
  elsif milestone_id_input = 'repay-100-total' then
    return total_repaid >= 100;
  elsif milestone_id_input = 'reach-level-three' then
    return is_verified and credit_limit >= 40;
  elsif milestone_id_input = 'trusted-borrower-candidate' then
    return on_time_paid_count >= 5 and unique_lender_count >= 3 and not has_unresolved_default;
  end if;

  return false;
end;
$$;
