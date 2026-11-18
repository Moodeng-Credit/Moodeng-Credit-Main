-- Food vouchers (1st on-time repayment, streak 3, streak 5) only count a repayment made in the second
-- half of the loan: on or after the halfway point between funding and the final due day. 2026-11-18:
-- people were borrowing for 30 days and repaying on day 1–2 to collect ₱50 (9 of the last 25 on-time
-- repayments came in the first quarter of the term, 7 of them in the 4 days after streak rewards went live).
--   * Early repayment is still fine: it simply earns nothing (no voucher, no streak step, no reset).
--   * Not retroactive: repayments before 2026-11-18 17:00 Bangkok keep the old 24-hour rule.
--   * The team can unlock one early repayment (/unlockreward @user in Telegram) when the borrower asks.
--     The app tells early repayers to message us for that.
--   * Affiliate / interest-refund rules (loan_counts_for_rewards) are unchanged.

create table if not exists app_private.voucher_early_unlocks (
  loan_id uuid primary key references public.loans (id) on delete cascade,
  unlocked_by text not null,
  created_at timestamptz not null default now()
);

-- When a repayment starts counting for food vouchers: the start (in the borrower's zone) of the day the
-- loan is halfway through, so the app can say "from Dec 1" and mean all of Dec 1. Never sooner than a
-- day after funding. Uses the final due day (a two-payment loan's whole term).
create or replace function app_private.loan_reward_from_at(p_loan public.loans)
returns timestamptz
language sql
stable
set search_path to ''
as $function$
  with z as (
    select case when app_private.is_usable_timezone(p_loan.due_timezone) then p_loan.due_timezone else 'Asia/Manila' end as zone,
      coalesce(p_loan.funded_at, p_loan.created_at) as funded,
      app_private.loan_day_end((p_loan.due_date at time zone 'UTC')::date, p_loan.due_timezone) as final_due
  ),
  h as (
    select z.*, z.funded + (z.final_due - z.funded) / 2 as halfway from z
  )
  select greatest(((h.halfway at time zone h.zone)::date)::timestamp at time zone h.zone, h.funded + interval '24 hours') from h;
$function$;

-- Does this repaid loan count toward food vouchers (on-time ones)? Late loans are handled by the callers.
create or replace function app_private.loan_counts_for_vouchers(p_loan public.loans)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when coalesce(p_loan.repaid_at, p_loan.updated_at) < timestamptz '2026-11-18 10:00:00+00'
      then app_private.loan_counts_for_rewards(p_loan)
    else coalesce(p_loan.repaid_at, p_loan.updated_at) >= app_private.loan_reward_from_at(p_loan)
      or exists (select 1 from app_private.voucher_early_unlocks u where u.loan_id = p_loan.id)
  end;
$function$;

revoke all on function app_private.loan_counts_for_vouchers(public.loans) from public;

create or replace function app_private.has_on_time_repayment(p_user_id uuid, p_exclude_lender uuid default null::uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select not exists (select 1 from app_private.voucher_blocked_users b where b.user_id = p_user_id)
  and exists (
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
      and coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l)
      and app_private.loan_counts_for_vouchers(l)
  );
$function$;

create or replace function app_private.repay_streak(p_user_id uuid, out current_streak integer, out best_streak integer)
returns record
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with paid as (
    select coalesce(l.repaid_at, l.updated_at) as paid_at,
      coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l) as on_time
    from public.loans l
    where l.borrower_user_id = p_user_id
      and l.repayment_status = 'Paid'
      and l.refunded_at is null
      and not coalesce(l.is_test, false)
      and case
            when coalesce(l.total_repayment_amount, 0) > 0 then coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
            else coalesce(l.repaid_amount, 0) > 0
          end
      -- A late loan always counts (it resets); an on-time one only when paid in the second half.
      and (coalesce(l.repaid_at, l.updated_at) >= app_private.loan_past_due_at(l) or app_private.loan_counts_for_vouchers(l))
      and not exists (select 1 from app_private.voucher_blocked_users b where b.user_id = p_user_id)
  ),
  runs as (
    select on_time, sum(case when on_time then 0 else 1 end) over (order by paid_at) as run from paid
  ),
  sized as (
    select run, count(*) filter (where on_time) as size from runs group by run
  )
  select
    case when app_private.has_overdue_loan(p_user_id) then 0
         else coalesce((select size from sized order by run desc limit 1), 0) end::integer,
    coalesce((select max(size) from sized), 0)::integer;
$function$;

-- The latest repayment, when it was on time but early (so it earned nothing), in the last 3 days.
create or replace function app_private.last_early_repayment(p_user_id uuid)
returns public.loans
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select l.*
  from public.loans l
  where l.borrower_user_id = p_user_id
    and l.repayment_status = 'Paid'
    and l.refunded_at is null
    and not coalesce(l.is_test, false)
    and coalesce(l.repaid_at, l.updated_at) > now() - interval '3 days'
  order by coalesce(l.repaid_at, l.updated_at) desc
  limit 1;
$function$;

revoke all on function app_private.last_early_repayment(uuid) from public;

-- Adds earlyPaid: { rewardFrom } when their latest repayment came before the halfway point (and the
-- team hasn't unlocked it), so the "You're paid" screen can say why there's no voucher.
create or replace function app_private.repay_reward_preview(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with s as (
    select r.current_streak as cur, r.best_streak as best, app_private.has_on_time_repayment(p_user_id) as first_done
    from app_private.repay_streak(p_user_id) r
  ),
  n as (
    select s.*,
      case when exists (select 1 from app_private.voucher_blocked_users b where b.user_id = p_user_id) then null
           when not first_done then 1
           when best < 3 then 3
           when best < 5 then 5
      end as next_step
    from s
  ),
  early as (
    select app_private.loan_reward_from_at(l) as reward_from
    from app_private.last_early_repayment(p_user_id) l
    where l.id is not null
      and coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l)
      and not app_private.loan_counts_for_vouchers(l)
  )
  select jsonb_build_object(
    'current', cur,
    'best', best,
    'nextStep', next_step,
    'toGo', case when next_step is null then null else greatest(next_step - cur, 1) end,
    'nextPhp', case when next_step is null then null else 50 end,
    'earlyPaid', (select jsonb_build_object('rewardFrom', e.reward_from) from early e where n.next_step is not null)
  )
  from n;
$function$;

-- For the team cards (service key only): how long a loan was held and whether it was paid before halfway.
create or replace function public.loan_reward_timing(p_loan_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'heldHours', round(extract(epoch from coalesce(l.repaid_at, l.updated_at, now()) - coalesce(l.funded_at, l.created_at)) / 3600, 1),
    'termHours', round(extract(epoch from app_private.loan_day_end((l.due_date at time zone 'UTC')::date, l.due_timezone) - coalesce(l.funded_at, l.created_at)) / 3600, 1),
    'rewardFrom', app_private.loan_reward_from_at(l),
    'zone', case when app_private.is_usable_timezone(l.due_timezone) then l.due_timezone else 'Asia/Manila' end,
    'early', l.repayment_status = 'Paid'
      and coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l)
      and not app_private.loan_counts_for_vouchers(l),
    'unlocked', exists (select 1 from app_private.voucher_early_unlocks u where u.loan_id = l.id)
  )
  from public.loans l
  where l.id = p_loan_id;
$function$;

revoke all on function public.loan_reward_timing(uuid) from public, anon, authenticated;
grant execute on function public.loan_reward_timing(uuid) to service_role;

-- /unlockreward @user: count their latest early repayment after all (service key only).
create or replace function public.unlock_early_reward(p_user_id uuid, p_by text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_loan public.loans;
begin
  select l.* into v_loan
  from public.loans l
  where l.borrower_user_id = p_user_id
    and l.repayment_status = 'Paid'
    and l.refunded_at is null
    and not coalesce(l.is_test, false)
    and coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l)
    and not app_private.loan_counts_for_vouchers(l)
  order by coalesce(l.repaid_at, l.updated_at) desc
  limit 1;

  if v_loan.id is null then
    return jsonb_build_object('ok', false, 'reason', 'no early repayment to unlock');
  end if;

  insert into app_private.voucher_early_unlocks (loan_id, unlocked_by) values (v_loan.id, coalesce(p_by, 'admin'))
  on conflict (loan_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'loanId', v_loan.id,
    'trackingId', v_loan.tracking_id,
    'claimable', coalesce((
      select jsonb_agg(t.reward) from unnest(app_private.voucher_rewards()) as t(reward)
      where app_private.voucher_eligible(p_user_id, t.reward)
        and not exists (select 1 from public.voucher_claims c where c.user_id = p_user_id and c.reward = t.reward and c.status <> 'rejected')
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.unlock_early_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.unlock_early_reward(uuid, text) to service_role;
