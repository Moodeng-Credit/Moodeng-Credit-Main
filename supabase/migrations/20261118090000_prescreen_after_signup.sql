-- Pre-screening after sign-up (George, 2026-11-18). People who open an affiliate's pre-screening link
-- (moodeng.app/screen/CODE) now:
--   1. make their account (/invite/CODE), 2. connect Facebook (Messenger code, as today),
--   3. do the pre-screening inside the app (tied to their account from the start),
--   4. wait for the team's ✅ Good fit / ❌ Not a fit on the card,
--   5. ✅ → Messenger "keep going" → Instant Wallet → about you → book the call. ❌ → the usual reject.
-- So nobody finishes the questions and then forgets to register, and weak applicants never cost an
-- Openfort wallet. Everyone else (no pre-screening link) keeps today's flow.

-- 1) Who is on this path ----------------------------------------------------------------------------
alter table public.users add column if not exists prescreen_path boolean not null default false;

-- Called by the app right after sign-in when this browser came from a /screen link. Only a borrower
-- still held by the pre-KYC gate (new, not approved) joins, so an old account opening a link changes nothing.
create or replace function public.join_prescreen_path()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  if not coalesce(public.needs_pre_kyc_gate(uid), false) then return false; end if;
  update public.users set prescreen_path = true
   where id = uid and user_role is distinct from 'lender' and created_at > now() - interval '7 days'
     and not prescreen_path;
  return exists (select 1 from public.users where id = uid and prescreen_path);
end;
$$;

revoke all on function public.join_prescreen_path() from public, anon;
grant execute on function public.join_prescreen_path() to authenticated;

-- Where they are: none (not started) | open (started) | sent (AI reading) | graded/failed (team to
-- decide) and the team's decision. on_path = still has these steps ahead of them.
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
  if not exists (select 1 from public.users where id = uid and prescreen_path)
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

-- Server side of the same rule (loan-access: no call booking before the team's ✅).
create or replace function public.team_prescreen_blocking(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.users u where u.id = p_user_id and u.prescreen_path)
     and coalesce(public.needs_pre_kyc_gate(p_user_id), false)
     and not exists (select 1 from public.pre_screenings s where s.user_id = p_user_id and s.team_decision = 'good');
$$;

revoke all on function public.team_prescreen_blocking(uuid) from public, anon, authenticated;
grant execute on function public.team_prescreen_blocking(uuid) to service_role;

-- 2) Start: a signed-in person's pre-screening is theirs from the first tap -----------------------
-- Same as 20261117200000 plus: signed in → resume their open one (same token), or tie the new one to
-- the account. Signed-out starts keep working as before (old links), but the page now sends people to
-- sign up first.
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

  daily_max := coalesce(nullif((select value from public.telegram_bot_settings where key = 'prescreen_daily_max'), '')::integer, 40);
  if (select count(*) from public.pre_screenings where created_at > now() - interval '1 day') >= daily_max then
    return jsonb_build_object('status', 'busy');
  end if;
  if caller_ip is not null
     and (select count(*) from public.pre_screenings where ip = caller_ip and created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('status', 'busy');
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
