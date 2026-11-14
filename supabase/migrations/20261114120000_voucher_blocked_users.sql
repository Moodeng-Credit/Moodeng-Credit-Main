-- Revoke food-voucher rewards for a person (e.g. borrow-and-repay-within-the-hour farming).
-- A blocked person earns no voucher of any kind: first on-time repayment, tier vouchers, and the
-- referral voucher on either side (their inviter's ₱100 for them goes too).
-- Both helpers below are used only by the voucher functions (get_my_rewards, submit_voucher_claim,
-- admin_unclaimed_vouchers, voucher_daily_digest), so the block covers the app, the claim, the admin
-- list and the Messenger nudges. Vouchers already sent are not affected.
-- Block: insert into app_private.voucher_blocked_users (user_id, reason) values (...);
-- Unblock: delete the row.

create table if not exists app_private.voucher_blocked_users (
  user_id uuid primary key references public.users (id) on delete cascade,
  reason text,
  blocked_at timestamptz not null default now()
);

revoke all on table app_private.voucher_blocked_users from public, anon, authenticated;

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
  );
$function$;

-- Voucher tiers only (not the credit ladder): a blocked person counts as 0 pandesal here.
create or replace function app_private.pandesal_total(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path to ''
as $function$
  select case
    when exists (select 1 from app_private.voucher_blocked_users b where b.user_id = p_user_id) then 0
    else coalesce((select points_total from public.user_trust_points where user_id = p_user_id), 0) / 1000000.0
  end;
$function$;
