-- Pre-screening for every new borrower (George, 2026-11-18). Until now only people who opened an
-- affiliate's /screen link went Facebook → pre-screening (videos + questions + proof of income) → team ✅
-- → wallet → call. Now every account made from the switch time on takes that same path, whether or not
-- they came from a link. People who already sent a pre-screening before signing up (claimed to their
-- account) just wait for the team's decision on it, as before.
--
-- Switch: telegram_bot_settings.prescreen_all = off | <ISO time>. Accounts created at or after that time
-- join the path at sign-up. Off = only affiliate-link people, as before. Turning `prescreen` off also
-- lets everyone on the path through (so nobody is stuck on a "link is closed" page).
-- Same pre-KYC gate rule as before: approved, verified, funded, lender and Indonesia accounts never see it.

-- 1) Switch ----------------------------------------------------------------------------------------
insert into public.telegram_bot_settings (key, value, description)
values ('prescreen_all', 'off',
        'Pre-screening for all: off, or an ISO time — accounts created from then do the pre-screening (videos, questions, income) after Facebook')
on conflict (key) do nothing;

create or replace function app_private.prescreen_all_since()
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  raw text := (select value from public.telegram_bot_settings where key = 'prescreen_all');
begin
  if raw is null or lower(btrim(raw)) in ('', 'off') then return null; end if;
  return raw::timestamptz;
exception when others then
  return null;
end;
$$;

revoke all on function app_private.prescreen_all_since() from public, anon, authenticated;

-- 2) New accounts join the path at sign-up -----------------------------------------------------------
-- Named zz_ so it runs after the other insert triggers.
create or replace function app_private.prescreen_all_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  since timestamptz := app_private.prescreen_all_since();
begin
  if since is not null and coalesce(new.created_at, now()) >= since
     and new.user_role is distinct from 'lender' and new.market is distinct from 'ID' then
    new.prescreen_path := true;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_prescreen_all_on_insert on public.users;
create trigger zz_prescreen_all_on_insert
  before insert on public.users
  for each row execute function app_private.prescreen_all_on_insert();

-- The path is now a gate for everyone: the person can't switch it off themselves.
create or replace function app_private.keep_prescreen_path_server_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and new.prescreen_path is distinct from old.prescreen_path then
    new.prescreen_path := old.prescreen_path;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_keep_prescreen_path_server_only on public.users;
create trigger trg_keep_prescreen_path_server_only
  before update of prescreen_path on public.users
  for each row execute function app_private.keep_prescreen_path_server_only();

-- 3) Safety valve: pre-screening switched off → nobody is held on the path ---------------------------
create or replace function public.my_prescreen_path()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s public.pre_screenings;
begin
  if uid is null then return jsonb_build_object('on_path', false); end if;
  if coalesce((select value from public.telegram_bot_settings where key = 'prescreen'), 'off') <> 'on'
     or not exists (select 1 from public.users where id = uid and prescreen_path)
     or not coalesce(public.needs_pre_kyc_gate(uid), false) then
    return jsonb_build_object('on_path', false);
  end if;
  select * into s from public.pre_screenings where user_id = uid order by (status <> 'open') desc, created_at desc limit 1;
  return jsonb_build_object(
    'on_path', true,
    'status', coalesce(s.status, 'none'),
    'decision', s.team_decision,
    'done', s.team_decision = 'good');
end;
$$;

revoke all on function public.my_prescreen_path() from public, anon;
grant execute on function public.my_prescreen_path() to authenticated;

create or replace function public.team_prescreen_blocking(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.telegram_bot_settings where key = 'prescreen'), 'off') = 'on'
     and exists (select 1 from public.users u where u.id = p_user_id and u.prescreen_path)
     and coalesce(public.needs_pre_kyc_gate(p_user_id), false)
     and not exists (select 1 from public.pre_screenings s where s.user_id = p_user_id and s.team_decision = 'good');
$$;

revoke all on function public.team_prescreen_blocking(uuid) from public, anon, authenticated;
grant execute on function public.team_prescreen_blocking(uuid) to service_role;

-- 4) The videos -------------------------------------------------------------------------------------
-- On 2026-11-17 the 3 videos moved to prescreen_config.journey_videos (for journey v2, still off), which
-- left /screen with none. No `videos` list → use journey_videos, so the pre-screening shows them again.
create or replace function app_private.pre_screening_videos(p_cfg jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_cfg->'videos') = 'array' and jsonb_array_length(p_cfg->'videos') > 0 then
      (select jsonb_agg(jsonb_build_object('id', v->>'id', 'title', coalesce(v->>'title', ''), 'tall', coalesce((v->>'tall')::boolean, false)))
         from jsonb_array_elements(p_cfg->'videos') v where coalesce(v->>'id', '') <> '')
    when coalesce(p_cfg->>'video', '') <> '' then jsonb_build_array(jsonb_build_object('id', p_cfg->>'video', 'title', '', 'tall', true))
    when jsonb_typeof(p_cfg->'journey_videos') = 'array' and jsonb_array_length(p_cfg->'journey_videos') > 0 then
      (select jsonb_agg(jsonb_build_object('id', v->>'id', 'title', coalesce(v->>'title', ''), 'tall', coalesce((v->>'tall')::boolean, false)))
         from jsonb_array_elements(p_cfg->'journey_videos') v where coalesce(v->>'id', '') <> '')
    else '[]'::jsonb
  end;
$$;

-- 5) Start: signed-in people are never "full for today" -------------------------------------------
-- Same as 20261118090000, except the daily cap (40) and the per-IP cap (10) only count signed-out
-- starts: every new borrower now has to do this, so a busy day must not lock them out.
create or replace function public.pre_screening_start(p_name text default null, p_ref text default null, p_browser text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg jsonb;
  qs jsonb;
  vids jsonb;
  ask_proof boolean;
  uid uuid := auth.uid();
  mine public.pre_screenings;
  clean_name text := nullif(left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80), '');
  clean_ref text := nullif(left(regexp_replace(coalesce(p_ref, ''), '[^A-Za-z0-9._-]', '', 'g'), 40), '');
  caller_ip text := nullif(btrim(split_part(coalesce(
      current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip',
      current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1)), '');
  daily_max integer;
  new_row public.pre_screenings;
begin
  if coalesce((select value from public.telegram_bot_settings where key = 'prescreen'), 'off') <> 'on' then
    return jsonb_build_object('status', 'closed');
  end if;
  begin
    cfg := (select value from public.telegram_bot_settings where key = 'prescreen_config')::jsonb;
  exception when others then
    cfg := null;
  end;
  qs := coalesce(cfg->'questions', '[]'::jsonb);
  if jsonb_typeof(qs) <> 'array' or jsonb_array_length(qs) = 0 then
    return jsonb_build_object('status', 'closed');
  end if;
  vids := coalesce(app_private.pre_screening_videos(cfg), '[]'::jsonb);
  ask_proof := coalesce((cfg->>'proof')::boolean, true);

  -- Signed in and already sent one: nothing to start.
  if uid is not null and exists (select 1 from public.pre_screenings where user_id = uid and status <> 'open') then
    return jsonb_build_object('status', 'sent');
  end if;

  if clean_name is null then
    return jsonb_build_object('status', 'ready', 'video', vids->0->>'id', 'videos', vids, 'proof', ask_proof,
                              'questions', app_private.pre_screening_public_questions(qs));
  end if;
  if length(clean_name) < 2 then raise exception 'bad_name'; end if;

  -- Signed in with one already started (today): carry on with the same token.
  if uid is not null then
    select * into mine from public.pre_screenings
     where user_id = uid and status = 'open' and created_at > now() - interval '20 hours'
     order by created_at desc limit 1;
    if mine.id is not null then
      return jsonb_build_object('status', 'open', 'token', mine.token, 'video', vids->0->>'id', 'videos', vids, 'proof', ask_proof,
                                'questions', app_private.pre_screening_public_questions(mine.questions));
    end if;
  end if;

  if uid is null then
    daily_max := coalesce(nullif((select value from public.telegram_bot_settings where key = 'prescreen_daily_max'), '')::integer, 40);
    if (select count(*) from public.pre_screenings where created_at > now() - interval '1 day' and user_id is null) >= daily_max then
      return jsonb_build_object('status', 'busy');
    end if;
    if caller_ip is not null
       and (select count(*) from public.pre_screenings where ip = caller_ip and created_at > now() - interval '1 day') >= 10 then
      return jsonb_build_object('status', 'busy');
    end if;
  end if;

  insert into public.pre_screenings (name, ref_code, video_id, questions, ip, browser, user_id, claimed_at)
  values (clean_name, clean_ref, (select string_agg(v->>'id', ',') from jsonb_array_elements(vids) v), qs, caller_ip,
          nullif(left(btrim(coalesce(p_browser, '')), 80), ''), uid, case when uid is not null then now() end)
  returning * into new_row;

  return jsonb_build_object('status', 'open', 'token', new_row.token, 'video', vids->0->>'id', 'videos', vids, 'proof', ask_proof,
                            'questions', app_private.pre_screening_public_questions(new_row.questions));
end;
$$;

revoke all on function public.pre_screening_start(text, text, text) from public;
grant execute on function public.pre_screening_start(text, text, text) to anon, authenticated;
