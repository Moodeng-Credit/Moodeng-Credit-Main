-- Shark Chomp rewards (George 2026-11-28: "there has to be something that comes out of it").
--
-- Every level cleared (signed in, approved, not blocked): +1 Pandesal point, at most 3 a day (Manila day).
-- Kept small on purpose: an on-time repayment is +10 and points unlock the ₱50–₱150 tier vouchers, so play
-- can't outrun paying back. Same level twice in a day pays once (idempotent source id).
--
-- Clearing level 3 or higher while a Limit Spin is waiting for day 3 (limit_boost_spins.applied_at null):
-- a +$1 "Shark bonus" on that spin, once per spin. app_private.unlock_limit_spins adds it at unlock, still
-- never past their ceiling. No repayment, no waiting spin, no bonus: the game never raises a limit alone.
--
-- The game runs in the browser with no proof of play, so both rewards are capped rather than trusted.

alter table public.limit_boost_spins add column if not exists bonus numeric not null default 0;

create or replace function public.chomp_level_reward(p_level integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare
   v_uid uuid := auth.uid();
   v_ok boolean;
   v_today date := (now() at time zone 'Asia/Manila')::date;
   v_count integer;
   v_applied boolean;
   v_points integer := 0;
   v_bonus boolean := false;
begin
   if v_uid is null then
      raise exception 'not authenticated' using errcode = '28000';
   end if;
   if p_level is null or p_level < 1 or p_level > 500 then
      return jsonb_build_object('points', 0, 'bonus', false);
   end if;
   select u.loan_access_status::text = 'approved'
          and u.account_status::text = 'active'
          and u.ghosted_at is null
          and u.blocked_for_good_at is null
          and not exists (select 1 from app_private.voucher_blocked_users b where b.user_id = u.id)
     into v_ok
   from public.users u where u.id = v_uid;
   if not coalesce(v_ok, false) then
      return jsonb_build_object('points', 0, 'bonus', false, 'reason', 'not_eligible');
   end if;

   select count(*) into v_count
   from public.trust_point_events e
   where e.user_id = v_uid and e.source_type = 'game'
     and e.created_at >= (v_today::timestamp at time zone 'Asia/Manila');
   if v_count < 3 then
      select a.applied into v_applied
      from private.award_trust_points(
         v_uid, 'game', md5(v_uid::text || ':' || v_today::text || ':' || p_level::text)::uuid, 'level_cleared',
         1000000, jsonb_build_object('level', p_level, 'day', v_today)) a;
      if v_applied then
         v_points := 1;
      end if;
   end if;

   if p_level >= 3 then
      update public.limit_boost_spins s set bonus = 1
      where s.id = (
         select w.id from public.limit_boost_spins w
         where w.user_id = v_uid and w.applied_at is null and w.bonus = 0
         order by w.unlocks_at
         limit 1
         for update skip locked)
      returning true into v_bonus;
   end if;

   return jsonb_build_object('points', v_points, 'bonus', coalesce(v_bonus, false));
end;
$function$;

revoke all on function public.chomp_level_reward(integer) from public, anon;
grant execute on function public.chomp_level_reward(integer) to authenticated;

-- Same as 20261128040000, plus the Shark bonus at unlock.
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
      select s.id, s.user_id, s.drawn, s.bonus
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
      v_to := greatest(v_cs, least(v_cs + r.drawn + coalesce(r.bonus, 0), v_ceiling, 135));
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
