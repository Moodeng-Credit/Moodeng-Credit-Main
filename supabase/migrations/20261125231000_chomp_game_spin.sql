-- Shark Chomp → Moo-Spin (George 2026-11-25: "wire the voucher raffle through moo-spin").
--
-- Clearing level 3 of Shark Chomp (moodeng.app/chomp, the game borrowers play while they wait for
-- their call) earns ONE Moo-Spin, ever, per person: a spin_tickets row with source 'game'. The prize
-- is drawn by spin_wheel() like every other spin (server-side odds, weekly pot, one cash prize per 30
-- days), so the game never decides what anyone wins.
--
-- The game runs in the browser with no proof of play, so the ticket is capped instead of trusted:
--   * one game ticket per person, ever (unique index)
--   * signed in, PH, not blocked/ghosted, and a call booked or already approved
-- People not approved yet keep the ticket; spin_wheel() lets them spin once spin_block_reason()
-- clears (approved after their call). Moo-Spin's own mode switch (off / team / on) still applies.

alter table public.spin_tickets drop constraint if exists spin_tickets_source_check;
alter table public.spin_tickets
  add constraint spin_tickets_source_check check (source in ('welcome', 'campaign', 'extra', 'game'));

create unique index if not exists spin_tickets_game_once on public.spin_tickets (user_id) where source = 'game';

-- Earn the Shark Chomp spin. Returns what happened, for the game and /spin?game=1:
--   { saved: true }                     new ticket
--   { saved: false, had: true }         they already earned it (spun or not)
--   { saved: false, reason: '...' }     not_ph | blocked | no_call
-- plus canSpin: true when Moo-Spin would let them spin right now (approved, mode allows).
create or replace function public.earn_game_spin()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_user public.users;
  v_reason text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select * into v_user from public.users where id = v_uid;
  if v_user.id is null then
    return jsonb_build_object('saved', false, 'reason', 'no_call');
  end if;

  v_reason := app_private.spin_block_reason(v_uid);
  if v_reason in ('not_ph', 'blocked') then
    return jsonb_build_object('saved', false, 'reason', v_reason);
  end if;
  -- Only people actually in the onboarding flow (a call booked) or already approved.
  if v_user.video_call_starts_at is null and v_user.loan_access_status::text is distinct from 'approved' then
    return jsonb_build_object('saved', false, 'reason', 'no_call');
  end if;

  insert into public.spin_tickets (user_id, source) values (v_uid, 'game')
  on conflict (user_id) where source = 'game' do nothing
  returning id into v_id;

  return jsonb_build_object(
    'saved', v_id is not null,
    'had', v_id is null,
    'canSpin', v_reason is null
  );
end;
$function$;

revoke all on function public.earn_game_spin() from public, anon;
grant execute on function public.earn_game_spin() to authenticated;

-- get_spin_state: same as 20261122120000_spin_wheel.sql, plus 'gameSpin' (an unused Shark Chomp
-- ticket) so /spin can say "your spin is saved" while they're not approved yet.
create or replace function public.get_spin_state(p_campaign text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_reason text;
  v_campaign public.spin_campaigns;
  v_code text := upper(nullif(btrim(coalesce(p_campaign, '')), ''));
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_reason := app_private.spin_block_reason(v_uid);
  if v_reason is null then
    insert into public.spin_tickets (user_id, source) values (v_uid, 'welcome')
    on conflict (user_id) where source = 'welcome' do nothing;
  end if;
  if v_code is not null then
    select * into v_campaign from public.spin_campaigns c
    where c.code = v_code and c.active and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now());
  end if;

  return jsonb_build_object(
    'blocked', v_reason,
    'test', app_private.spin_is_test(v_uid),
    'segment', app_private.spin_segment(v_uid),
    'ready', (select count(*) from public.spin_tickets t where t.user_id = v_uid and t.used_at is null and t.available_at <= now()),
    'nextAt', (select min(t.available_at) from public.spin_tickets t where t.user_id = v_uid and t.used_at is null and t.available_at > now()),
    'welcomeReady', exists (select 1 from public.spin_tickets t where t.user_id = v_uid and t.source = 'welcome' and t.used_at is null),
    'gameSpin', exists (select 1 from public.spin_tickets t where t.user_id = v_uid and t.source = 'game' and t.used_at is null),
    'potLeft', app_private.spin_pot_left(),
    'campaign', case when v_campaign.code is null then null else jsonb_build_object(
      'code', v_campaign.code, 'title', v_campaign.title, 'body', v_campaign.body, 'videoUrl', v_campaign.video_url,
      'question', v_campaign.question, 'options', v_campaign.options,
      'done', exists (select 1 from public.spin_tickets t where t.user_id = v_uid and t.campaign_code = v_campaign.code)
    ) end,
    'campaignMissing', v_code is not null and v_campaign.code is null,
    'prizes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'prize', s.prize, 'amountPhp', s.amount_php, 'createdAt', s.created_at,
        'expiresAt', s.expires_at, 'status', app_private.spin_status(s)
      ) order by s.created_at desc)
      from public.spins s
      where s.user_id = v_uid and s.prize in ('grab100', 'food50', 'locked50') and s.created_at > now() - interval '120 days'
    ), '[]'::jsonb)
  );
end;
$function$;
