-- Shark bonus at the end of every spin (George 2026-11-28: "offer the shark bonus at the end of each spin
-- to play"). Beating level 3 of Shark Chomp gives +$1 on a Limit Spin. Until now that only worked while a
-- spin was waiting for day 3; right after a spin nothing is waiting, so the +$1 is now SAVED for their next
-- spin (one at a time). _shared/repaymentFollowUps.ts adds it to the next spin it draws (bonus column) and
-- clears the save. Only for people on the spin ladder (they've had a spin before). Never past the ceiling.

create table if not exists public.limit_spin_bonus_bank (
   user_id uuid primary key references public.users(id) on delete cascade,
   banked_at timestamptz not null default now()
);
alter table public.limit_spin_bonus_bank enable row level security;
revoke all on public.limit_spin_bonus_bank from anon, authenticated;

-- Same as 20261128050000, plus: no waiting spin → save the +$1 for the next one.
--   { points, bonus, banked }   bonus true = +$1 given; banked true = it was saved for the next spin
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
   v_banked boolean := false;
begin
   if v_uid is null then
      raise exception 'not authenticated' using errcode = '28000';
   end if;
   if p_level is null or p_level < 1 or p_level > 500 then
      return jsonb_build_object('points', 0, 'bonus', false, 'banked', false);
   end if;
   select u.loan_access_status::text = 'approved'
          and u.account_status::text = 'active'
          and u.ghosted_at is null
          and u.blocked_for_good_at is null
          and not exists (select 1 from app_private.voucher_blocked_users b where b.user_id = u.id)
     into v_ok
   from public.users u where u.id = v_uid;
   if not coalesce(v_ok, false) then
      return jsonb_build_object('points', 0, 'bonus', false, 'banked', false, 'reason', 'not_eligible');
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
      -- Nothing waiting: save it for the next spin (spin-ladder people only, one saved at a time).
      if not coalesce(v_bonus, false)
         and exists (select 1 from public.limit_boost_spins x where x.user_id = v_uid)
         and not exists (select 1 from public.limit_boost_spins w where w.user_id = v_uid and w.applied_at is null) then
         insert into public.limit_spin_bonus_bank (user_id) values (v_uid)
         on conflict (user_id) do nothing
         returning true into v_banked;
         v_bonus := coalesce(v_banked, false);
      end if;
   end if;

   return jsonb_build_object('points', v_points, 'bonus', coalesce(v_bonus, false), 'banked', coalesce(v_banked, false));
end;
$function$;

revoke all on function public.chomp_level_reward(integer) from public, anon;
grant execute on function public.chomp_level_reward(integer) to authenticated;
