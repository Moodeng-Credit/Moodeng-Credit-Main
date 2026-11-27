-- Pay anytime, spin on day 3 (George 2026-11-28: "day 7 is too late"). Low-income borrowers can repay
-- whenever they like; every counted repayment earns a Limit Spin, and the spin unlocks 3 days after the loan
-- was funded (creditAndPoints limitSpinUnlockAt). Paid sooner, _shared/repaymentFollowUps.ts saves the spin
-- with unlocks_at in the future and applied_at null, and app_private.unlock_limit_spins (cron below) raises
-- users.cs when it unlocks. That raise sets off private.notify_limit_up, and admin-messenger sends "your spin
-- is ready" (no amount) because the row has waited = true. The app shows a countdown until then.

-- Defaults keep any spin saved the old way (raised at repayment) counted as applied.
alter table public.limit_boost_spins
   add column if not exists unlocks_at timestamptz not null default now(),
   add column if not exists applied_at timestamptz default now(),
   add column if not exists waited boolean not null default false;
update public.limit_boost_spins set unlocks_at = created_at, applied_at = created_at where not waited;

-- One spin per loan (a repeated repayment follow-up can't save two).
create unique index if not exists limit_boost_spins_loan_uniq on public.limit_boost_spins (loan_id) where loan_id is not null;
create index if not exists limit_boost_spins_pending_idx on public.limit_boost_spins (unlocks_at) where applied_at is null;

-- The latest spin they haven't watched yet: only ones already applied (a waiting spin isn't ready).
create or replace function public.my_unseen_limit_spin()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select to_jsonb(s) - 'user_id'
  from public.limit_boost_spins s
  where s.user_id = auth.uid() and s.applied_at is not null and s.seen_at is null
    and s.applied_at > now() - interval '14 days'
  order by s.applied_at desc
  limit 1;
$function$;

-- When their next waiting spin unlocks (the countdown card), or null. Never the amount.
create or replace function public.my_next_limit_spin()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select case when min(s.unlocks_at) is null then null else jsonb_build_object('unlocks_at', min(s.unlocks_at)) end
  from public.limit_boost_spins s
  where s.user_id = auth.uid() and s.applied_at is null;
$function$;

revoke all on function public.my_next_limit_spin() from public, anon;
grant execute on function public.my_next_limit_spin() to authenticated;

-- Raise the limit for every spin that has unlocked. Only 8 AM to 9 PM Manila, so "your spin is ready"
-- never lands in the night; a spin due overnight unlocks at 8 AM. The raise is worked out now, from the
-- limit and ceiling they have today (never past the ceiling, never lowers). Paused credit progression or an
-- unreadable ceiling: the spin keeps waiting. Nothing left to raise (already at the top): marked done and
-- seen, so no empty wheel shows. Returns how many spins it applied.
create or replace function app_private.unlock_limit_spins()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
   r record;
   v_cs numeric;
   v_paused boolean;
   v_ceiling numeric;
   v_to numeric;
   v_done integer := 0;
begin
   if (now() at time zone 'Asia/Manila')::time not between time '08:00' and time '21:00' then
      return 0;
   end if;
   for r in
      select s.id, s.user_id, s.drawn
      from public.limit_boost_spins s
      where s.applied_at is null and s.unlocks_at <= now()
      order by s.unlocks_at
      for update skip locked
   loop
      select coalesce(u.cs, 15), coalesce(u.credit_progression_paused, false) into v_cs, v_paused
      from public.users u where u.id = r.user_id
      for update;
      if not found or v_paused then
         continue;
      end if;
      v_ceiling := (app_private.limit_ceiling(r.user_id)->>'ceiling')::numeric;
      if v_ceiling is null or v_ceiling <= 0 then
         continue;
      end if;
      v_to := greatest(v_cs, least(v_cs + r.drawn, v_ceiling, 135));
      if v_to > v_cs then
         -- The spin row first: the limit-up message (pg_net, sent after commit) looks for it.
         update public.limit_boost_spins set applied_at = now(), from_limit = v_cs, to_limit = v_to where id = r.id;
         update public.users set cs = v_to where id = r.user_id;
      else
         update public.limit_boost_spins set applied_at = now(), from_limit = v_cs, to_limit = v_cs, seen_at = now() where id = r.id;
      end if;
      v_done := v_done + 1;
   end loop;
   return v_done;
end;
$function$;

revoke all on function app_private.unlock_limit_spins() from public, anon, authenticated;

select cron.schedule('unlock-limit-spins', '*/10 * * * *', $$select app_private.unlock_limit_spins();$$);
