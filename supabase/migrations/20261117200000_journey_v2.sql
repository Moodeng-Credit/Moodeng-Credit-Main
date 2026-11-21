-- Journey v2 (George, 2026-11-17): new borrowers prove their income and watch the 3 short videos right
-- after sign-up, and the AI check on that proof decides whether they go on to onboarding
-- (Facebook → WhatsApp → bio → book the call). The wallet moves to after the team's ✅.
--
--   Pre-screening (moodeng.app/screen/CODE) stays ONLY for people an affiliate sends that link to.
--   Proof of income uses /documents as it is (income_documents + its AI checks + team Approve/Decline).
--   "AI check" = that document's result:
--     pass     the team approved it, or the AI scored it 60+ (0–100) with no fraud signs
--     hold     score under 60, fraud signs, or the read failed → the team's ✅ Approve / ❌ Decline card
--     resend   fixable problem → they send it again (the page already says what to fix)
--     declined the team declined it → they can send a new one
--
-- Switch: telegram_bot_settings.journey_v2 = off | <ISO time>. Only accounts created at or after that
-- time get v2 (people already mid-onboarding keep the old order). Off = everyone on the old order.
-- Only for borrowers the pre-KYC gate still holds (needs_pre_kyc_gate), so approved, verified,
-- funded and Indonesia-track borrowers never see it.

-- 1) Switch + progress -----------------------------------------------------------------------------
insert into public.telegram_bot_settings (key, value, description)
values ('journey_v2', 'off',
        'Journey v2: off, or an ISO time — accounts created from then prove income + watch 3 videos before onboarding')
on conflict (key) do nothing;

-- How many of the 3 videos (prescreen_config.videos) played to the end on /onboarding/verify.
alter table public.users add column if not exists journey_videos_watched integer not null default 0;

-- 2) Does v2 apply to this person? -----------------------------------------------------------------
create or replace function app_private.journey_v2_applies(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  raw text := (select value from public.telegram_bot_settings where key = 'journey_v2');
  since timestamptz;
begin
  if raw is null or lower(btrim(raw)) in ('', 'off') then return false; end if;
  begin
    since := raw::timestamptz;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from public.users u
    where u.id = p_user_id
      and u.created_at >= since
      and u.user_role is distinct from 'lender'
  ) and coalesce(public.needs_pre_kyc_gate(p_user_id), false);
end;
$$;

revoke all on function app_private.journey_v2_applies(uuid) from public, anon, authenticated;

-- The AI check, from their latest proof-of-income send.
create or replace function app_private.journey_income_check(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    -- George 2026-11-17: the AI's score 60+ passes by itself; anything lower waits for the team.
    -- Fraud signs (risk red) always wait for the team, whatever the score.
    select case
             when d.decision = 'approved' then 'pass'
             when d.decision = 'declined' then 'declined'
             when d.verdict = 'resend' then 'resend'
             when d.status in ('pending', 'processing') then 'checking'
             when d.risk = 'red' then 'hold'
             when d.score >= 60 then 'pass'
             else 'hold'
           end
    from public.income_documents d
    where d.user_id = p_user_id
    order by d.created_at desc
    limit 1
  ), 'none');
$$;

revoke all on function app_private.journey_income_check(uuid) from public, anon, authenticated;

-- The 3 videos for /onboarding/verify: prescreen_config.journey_videos (same shape as "videos").
create or replace function app_private.journey_videos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg jsonb;
begin
  begin
    cfg := (select value from public.telegram_bot_settings where key = 'prescreen_config')::jsonb;
  exception when others then
    return '[]'::jsonb;
  end;
  return coalesce(app_private.pre_screening_videos(jsonb_build_object('videos', cfg->'journey_videos')), '[]'::jsonb);
end;
$$;

revoke all on function app_private.journey_videos() from public, anon, authenticated;

-- Still has v2 steps to do (used by loan-access: no call booking before they're through).
create or replace function app_private.journey_v2_blocking(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.journey_v2_applies(p_user_id)
     and (
       app_private.journey_income_check(p_user_id) <> 'pass'
       or coalesce((select u.journey_videos_watched from public.users u where u.id = p_user_id), 0)
          < jsonb_array_length(app_private.journey_videos())
     );
$$;

revoke all on function app_private.journey_v2_blocking(uuid) from public, anon, authenticated;
grant execute on function app_private.journey_v2_blocking(uuid) to service_role;

-- 3) For the app -----------------------------------------------------------------------------------
-- {applies, income: none|checking|resend|hold|pass|declined, videos_watched, videos:[{id,title,tall}], done}
create or replace function public.my_journey_v2()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  vids jsonb;
  watched integer;
  income text;
begin
  if uid is null or not app_private.journey_v2_applies(uid) then
    return jsonb_build_object('applies', false);
  end if;
  vids := app_private.journey_videos();
  watched := coalesce((select u.journey_videos_watched from public.users u where u.id = uid), 0);
  income := app_private.journey_income_check(uid);
  return jsonb_build_object(
    'applies', true,
    'income', income,
    'videos', vids,
    'videos_watched', watched,
    'done', income = 'pass' and watched >= jsonb_array_length(vids));
end;
$$;

revoke all on function public.my_journey_v2() from public, anon;
grant execute on function public.my_journey_v2() to authenticated;

-- The page saves how many videos played to the end (never goes down).
create or replace function public.journey_videos_watched(p_count integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.users
     set journey_videos_watched = greatest(journey_videos_watched, least(greatest(coalesce(p_count, 0), 0), 10))
   where id = auth.uid()
  returning journey_videos_watched;
$$;

revoke all on function public.journey_videos_watched(integer) from public, anon;
grant execute on function public.journey_videos_watched(integer) to authenticated;

-- 4) Affiliate link vs pre-screening, for the team ---------------------------------------------------
-- A pre-screening someone started but didn't finish is tied to the account too (status stays 'open'),
-- so the team can see "started, didn't finish". Only a finished one tells the team on sign-up.
create or replace function public.claim_pre_screening(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s public.pre_screenings;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into s from public.pre_screenings where token = p_token for update;
  if s.id is null then return false; end if;
  if s.user_id is not null then return s.user_id = uid; end if;
  -- One per account; a finished one replaces an unfinished one.
  if exists (select 1 from public.pre_screenings where user_id = uid and (status <> 'open' or s.status = 'open')) then
    return false;
  end if;
  update public.pre_screenings set user_id = null, claimed_at = null where user_id = uid and status = 'open';
  update public.pre_screenings set user_id = uid, claimed_at = now() where id = s.id;
  if s.status <> 'open' then
    perform app_private.pre_screening_call(jsonb_build_object('prescreen_claimed', s.id));
  end if;
  return true;
end;
$$;

revoke all on function public.claim_pre_screening(text) from public, anon;
grant execute on function public.claim_pre_screening(text) to authenticated;

-- One line for the call card: who sent them and how their pre-screening went.
--   "Pre-screen: 🟢 Good · 86/100 · from Belle's link"
--   "⚠️ From Belle's link — skipped the pre-screening" / "⚠️ Started the pre-screening, didn't finish"
-- null = nobody's link and no pre-screening.
create or replace function app_private.screening_line(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.pre_screenings;
  inviter text;
  verdict_label text;
begin
  select coalesce(nullif(btrim(r.display_name), ''), '@' || r.username, 'an affiliate') into inviter
  from public.friend_referrals f join public.users r on r.id = f.referrer_user_id
  where f.referred_user_id = p_user_id
  limit 1;

  select * into s from public.pre_screenings
  where user_id = p_user_id
  order by (status <> 'open') desc, created_at desc
  limit 1;

  if s.id is null then
    return case when inviter is not null then '⚠️ From ' || inviter || '’s link — no pre-screening' end;
  end if;
  if s.status = 'open' then
    return '⚠️ Started the pre-screening, didn’t finish' || coalesce(' · from ' || inviter || '’s link', '');
  end if;
  verdict_label := case s.verdict when 'good' then '🟢 Good' when 'ok' then '🟡 OK' when 'weak' then '🔴 Weak' else '⚪ Not graded' end;
  return 'Pre-screen: ' || verdict_label || coalesce(' · ' || s.score || '/100', '')
         || coalesce(' · from ' || inviter || '’s link', '');
end;
$$;

revoke all on function app_private.screening_line(uuid) from public, anon, authenticated;

-- PostgREST only reaches public: a thin wrapper for the edge functions (service role only).
create or replace function public.team_screening_line(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.screening_line(p_user_id);
$$;

revoke all on function public.team_screening_line(uuid) from public, anon, authenticated;
grant execute on function public.team_screening_line(uuid) to service_role;

create or replace function public.team_journey_v2_blocking(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.journey_v2_blocking(p_user_id);
$$;

revoke all on function public.team_journey_v2_blocking(uuid) from public, anon, authenticated;
grant execute on function public.team_journey_v2_blocking(uuid) to service_role;

-- 5) Pre-screening page: prescreen_config.proof = false drops its proof-of-income step ------------
-- (journey v2 asks for it after sign-up). Same function as 20261117180000, plus 'proof'.
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

  if clean_name is null then
    return jsonb_build_object('status', 'ready', 'video', vids->0->>'id', 'videos', vids, 'proof', ask_proof,
                              'questions', app_private.pre_screening_public_questions(qs));
  end if;
  if length(clean_name) < 2 then raise exception 'bad_name'; end if;

  daily_max := coalesce(nullif((select value from public.telegram_bot_settings where key = 'prescreen_daily_max'), '')::integer, 40);
  if (select count(*) from public.pre_screenings where created_at > now() - interval '1 day') >= daily_max then
    return jsonb_build_object('status', 'busy');
  end if;
  if caller_ip is not null
     and (select count(*) from public.pre_screenings where ip = caller_ip and created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('status', 'busy');
  end if;

  insert into public.pre_screenings (name, ref_code, video_id, questions, ip, browser)
  values (clean_name, clean_ref, (select string_agg(v->>'id', ',') from jsonb_array_elements(vids) v), qs, caller_ip,
          nullif(left(btrim(coalesce(p_browser, '')), 80), ''))
  returning * into new_row;

  return jsonb_build_object('status', 'open', 'token', new_row.token, 'video', vids->0->>'id', 'videos', vids, 'proof', ask_proof,
                            'questions', app_private.pre_screening_public_questions(new_row.questions));
end;
$$;

revoke all on function public.pre_screening_start(text, text, text) from public;
grant execute on function public.pre_screening_start(text, text, text) to anon, authenticated;

-- The journey's 3 videos (the pre-screening keeps its own "videos" until journey v2 is switched on;
-- then set prescreen_config.videos = [] and proof = false so /screen is just the 4 answers).
update public.telegram_bot_settings
   set value = (value::jsonb || jsonb_build_object('journey_videos', value::jsonb->'videos'))::text
 where key = 'prescreen_config' and (value::jsonb ? 'journey_videos') is not true;
