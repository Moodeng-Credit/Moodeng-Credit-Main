-- Limit Spin (George, 2026-11-27): low-income borrowers (income ceiling $35, Track B) repay after about a
-- week, and teaching them otherwise hasn't worked. So each repayment that counts (from day 7) earns a spin
-- that raises their limit by +$2 (usually) to +$5, never past their ceiling. The server draws it in
-- _shared/repaymentFollowUps.ts (the only writer of users.cs) and saves it here; the app's wheel lands on
-- the saved result on the paid screen, or from a "You earned a spin" card on home if they missed it.
-- They also no longer see "too early" lessons ("Your limit stays" is skipped for them below).

create table if not exists public.limit_boost_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  loan_id uuid references public.loans(id) on delete set null,
  drawn numeric not null,
  from_limit numeric not null,
  to_limit numeric not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists limit_boost_spins_user_idx on public.limit_boost_spins (user_id, created_at desc);
alter table public.limit_boost_spins enable row level security;
revoke all on public.limit_boost_spins from anon, authenticated;

-- The latest spin they haven't watched yet (last 14 days).
create or replace function public.my_unseen_limit_spin()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select to_jsonb(s) - 'user_id'
  from public.limit_boost_spins s
  where s.user_id = auth.uid() and s.seen_at is null and s.created_at > now() - interval '14 days'
  order by s.created_at desc
  limit 1;
$function$;

create or replace function public.mark_limit_spin_seen(p_id uuid)
returns void
language sql
security definer
set search_path to ''
as $function$
  update public.limit_boost_spins set seen_at = now() where id = p_id and user_id = auth.uid() and seen_at is null;
$function$;

revoke all on function public.my_unseen_limit_spin() from public, anon;
revoke all on function public.mark_limit_spin_seen(uuid) from public, anon;
grant execute on function public.my_unseen_limit_spin() to authenticated;
grant execute on function public.mark_limit_spin_seen(uuid) to authenticated;

-- No "too early" lesson for the low-income ladder: they just pay, and a spin comes from day 7.
create or replace function public.my_limit_notice()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with me as (
    select u.id, coalesce(u.cs, 15) as cs,
      (coalesce((app_private.limit_ceiling(u.id)->>'ceiling')::numeric, 1000) <= 35
        and u.created_at >= timestamptz '2026-10-01 00:00:00+07') as low_income
    from public.users u where u.id = auth.uid()
  ),
  reset as (
    select max(a.created_at) as at from public.admin_audit_logs a, me
    where a.target_user_id = me.id and a.action = 'credit_limit_reset_fast_repay' and a.created_at > now() - interval '30 days'
      and me.cs <= 15
  ),
  fast as (
    select max(l.repaid_at) as at from public.loans l, me
    where l.borrower_user_id = me.id and l.repayment_status = 'Paid' and l.refunded_at is null
      and not me.low_income
      and l.credit_limit_at_repayment is not null and l.loan_amount >= l.credit_limit_at_repayment
      and l.credit_limit_at_repayment >= me.cs
      and me.cs < coalesce((app_private.limit_ceiling(me.id)->>'ceiling')::numeric, 1000)
      and l.funded_at is not null
      and l.repaid_at < case
        when l.funded_at >= timestamptz '2026-11-27 00:00:00+07' then app_private.loan_reward_from_at(l)
        else l.funded_at + interval '48 hours'
      end
      and l.repaid_at > now() - interval '30 days'
  )
  select case when me.id is null then jsonb_build_object('show', false)
    else jsonb_build_object(
      'show', (select at from reset) is not null or (select at from fast) is not null,
      'limit', me.cs,
      'since', greatest((select at from reset), (select at from fast)))
  end
  from (select 1) one left join me on true;
$function$;
