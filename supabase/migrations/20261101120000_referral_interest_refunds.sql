-- Referral interest refunds ("Pay zero interest — refer friends and we cover it").
--
-- Repayments go straight from the borrower's wallet to the lender's, so Moodeng can't waive interest
-- up front. Instead it refunds it: when a friend who joined with your invite code (friend_referrals)
-- has fully repaid a loan, the interest you paid on your latest repaid loan is queued here, capped at
-- $5, and the team sends it in USDC to your wallet (Admin → Referral codes → Interest refunds).
--
-- Rules (all checked here, never in the browser):
--   * The friend signed up with your code (friend_referrals) and fully repaid a loan: not refunded,
--     not a test loan, and not a loan you funded yourself.
--   * Your loan is fully repaid, not refunded, not a test loan, and had interest.
--   * One refund per friend, one refund per loan. If you have no repaid loan yet, the refund is queued
--     the moment you repay one.

create table if not exists public.interest_refunds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  friend_referral_id uuid unique references public.friend_referrals(id) on delete set null,
  loan_id uuid unique references public.loans(id) on delete set null,
  interest_usd numeric(10, 2) not null,
  amount_usd numeric(10, 2) not null,
  status text not null default 'pending',
  tx_hash text,
  sent_at timestamptz,
  sent_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interest_refunds_amount_positive check (amount_usd > 0 and amount_usd <= interest_usd),
  constraint interest_refunds_status check (status in ('pending', 'sent'))
);

create index if not exists idx_interest_refunds_user on public.interest_refunds (user_id);

drop trigger if exists update_interest_refunds_updated_at on public.interest_refunds;
create trigger update_interest_refunds_updated_at before update on public.interest_refunds
  for each row execute function public.update_updated_at_column();

alter table public.interest_refunds enable row level security;

drop policy if exists "Borrowers read their interest refunds" on public.interest_refunds;
create policy "Borrowers read their interest refunds" on public.interest_refunds
  for select to authenticated using (user_id = auth.uid() or app_private.is_moodeng_admin());

drop policy if exists "Admins update interest refunds" on public.interest_refunds;
create policy "Admins update interest refunds" on public.interest_refunds
  for update to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

revoke insert, update, delete on public.interest_refunds from anon, authenticated;
grant select on public.interest_refunds to authenticated;
-- Admins may only record the payment, never change who is owed or how much.
grant update (status, tx_hash, sent_at, sent_by) on public.interest_refunds to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Queueing
-- ---------------------------------------------------------------------------------------------

-- Same "fully repaid" test as app_private.has_on_time_repayment, without the on-time rule.
create or replace function app_private.is_fully_repaid_loan(l public.loans)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select l.repayment_status = 'Paid'
    and l.refunded_at is null
    and not coalesce(l.is_test, false)
    and case
          when coalesce(l.total_repayment_amount, 0) > 0 then coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
          else coalesce(l.repaid_amount, 0) > 0
        end;
$$;

create or replace function app_private.queue_interest_refunds(p_inviter uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_referral record;
  v_loan record;
  v_queued integer := 0;
begin
  if p_inviter is null then
    return 0;
  end if;

  for v_referral in
    select r.id
    from public.friend_referrals r
    where r.referrer_user_id = p_inviter
      and not exists (select 1 from public.interest_refunds ir where ir.friend_referral_id = r.id)
      and exists (
        select 1 from public.loans fl
        where fl.borrower_user_id = r.referred_user_id
          and fl.lender_user_id is distinct from p_inviter
          and app_private.is_fully_repaid_loan(fl)
      )
    order by r.created_at
  loop
    select l.id, round(l.total_repayment_amount - l.loan_amount, 2) as interest
      into v_loan
    from public.loans l
    where l.borrower_user_id = p_inviter
      and app_private.is_fully_repaid_loan(l)
      and coalesce(l.total_repayment_amount, 0) > coalesce(l.loan_amount, 0)
      and not exists (select 1 from public.interest_refunds ir where ir.loan_id = l.id)
    order by coalesce(l.repaid_at, l.updated_at) desc
    limit 1;

    -- No repaid loan of theirs left to refund: it's queued when they repay their next one.
    exit when v_loan.id is null;

    insert into public.interest_refunds (user_id, friend_referral_id, loan_id, interest_usd, amount_usd)
    values (p_inviter, v_referral.id, v_loan.id, v_loan.interest, least(v_loan.interest, 5))
    on conflict do nothing;
    v_queued := v_queued + 1;
  end loop;

  return v_queued;
end;
$$;

-- Any repayment can complete either side: the borrower as an inviter (their own loan) or as someone's
-- friend (the friend's loan). Never blocks the repayment itself.
create or replace function app_private.queue_interest_refunds_on_repayment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app_private.is_fully_repaid_loan(new) then
    return new;
  end if;
  begin
    perform app_private.queue_interest_refunds(new.borrower_user_id);
    perform app_private.queue_interest_refunds(r.referrer_user_id)
    from public.friend_referrals r
    where r.referred_user_id = new.borrower_user_id;
  exception when others then
    raise warning 'queue_interest_refunds failed for loan %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists queue_interest_refunds_on_repayment on public.loans;
create trigger queue_interest_refunds_on_repayment
  after insert or update of repayment_status, repaid_amount, refunded_at on public.loans
  for each row execute function app_private.queue_interest_refunds_on_repayment();

-- ---------------------------------------------------------------------------------------------
-- Borrower-facing: the refer page's tracker. Friends are shown without names.
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_my_interest_refunds()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (select auth.uid() as id),
  friends as (
    select r.id, r.created_at,
      exists (
        select 1 from public.loans fl
        where fl.borrower_user_id = r.referred_user_id
          and fl.lender_user_id is distinct from r.referrer_user_id
          and app_private.is_fully_repaid_loan(fl)
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
        'sentAt', ir.sent_at,
        'txHash', ir.tx_hash
      ) order by f.created_at desc)
      from friends f
      left join public.interest_refunds ir on ir.friend_referral_id = f.id
    ), '[]'::jsonb),
    'totalRefundedUsd', coalesce((select sum(amount_usd) from public.interest_refunds, me where user_id = me.id and status = 'sent'), 0)
  );
$$;

revoke all on function public.get_my_interest_refunds() from public;
revoke all on function app_private.queue_interest_refunds(uuid) from public;
revoke all on function app_private.queue_interest_refunds_on_repayment() from public;
revoke all on function app_private.is_fully_repaid_loan(public.loans) from public;
grant execute on function public.get_my_interest_refunds() to authenticated;
