-- Pre-screening v2 (George 2026-11-20): job → job-specific follow-ups + live job photos → income → medical.
--
--   job       "What is your job?" (kind 'job'). Typed, then check-loan-input {"kind":"prescreen_job"} asks
--             Gemini for 1-2 follow-ups (kind of job, role), 1-2 job photos and an optional certificate of
--             employment for salaried jobs, and writes them into this row's questions right after 'job'
--             (fixed fallback list for common jobs when Gemini fails). The page never writes questions.
--   photos    kind 'photo': taken with the camera inside the page. pre_screening_photo_ask() stamps the
--             time the ask was shown (server clock); submit compares it with the upload time
--             (storage.objects.created_at) and marks the answer late after 5 minutes (+30 s for the upload).
--   coe       kind 'doc', optional: a certificate of employment (photo or PDF).
--   job_video kind 'video': a short live clip at work (config v2_job_video, default on).
--   medical   kind 'medical': "Do you or your family have a medical problem?" + what the loan is for
--             (choice). Gemini grades how big / chronic / future-facing it is (grade.medical); a high grade
--             is a red flag that stops auto ✅ (preScreeningAsk.ts). Never an auto ❌.
--
-- Typed answers can be coached once (check-loan-input {"kind":"prescreen_coach"}): the answer keeps the
-- first try ("first") and the hint shown ("coach") next to the final text.
--
-- Switch: prescreen_config.v2 = true. Off by default. Only pages that say they can do v2 (p_caps 'v2')
-- get the new questions, so an old bundle never sees a kind it can't show. Rows started before keep
-- their questions.

-- 1) Columns ---------------------------------------------------------------------------------------
-- {"<question id>": ["<asked at>", ...], "_plans": <how many job plans were made>}
alter table public.pre_screenings add column if not exists asks jsonb not null default '{}'::jsonb;

-- 2) Room for the photos, the job clip and the certificate -------------------------------------------
create or replace function app_private.pre_screening_open(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- At most 40 files per link: answers (video + sound), up to 6 proof-of-income files, 2 job photos and
  -- their retakes, a certificate, and retries.
  select exists (
    select 1 from public.pre_screenings s
    where s.token = p_token and p_token ~ '^[0-9a-f]{32}$' and s.status = 'open' and s.created_at > now() - interval '1 day'
  ) and (
    select count(*) from storage.objects o
    where o.bucket_id = 'pre-screenings' and o.name like p_token || '/%'
  ) < 40;
$$;

-- 3) What the page sees of each question (never "good") -------------------------------------------
create or replace function app_private.pre_screening_public_questions(p_questions jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', q->>'id', 'text', q->>'text', 'hint', q->>'hint', 'kind', q->>'kind', 'min', q->'min',
           'alt', q->>'alt', 'optional', case when (q->>'optional')::boolean then true end))), '[]'::jsonb)
  from jsonb_array_elements(p_questions) q;
$$;

revoke all on function app_private.pre_screening_public_questions(jsonb) from public, anon, authenticated;

-- 4) Start: + p_caps ---------------------------------------------------------------------------------
-- Same as 20261118180000, plus: a signed-in page that sends p_caps ['v2'] while prescreen_config.v2 is
-- on gets the job + medical questions (prescreen_config.v2_questions) after the usual ones. "v2" in the
-- reply says the row has them.
drop function if exists public.pre_screening_start(text, text, text);

create or replace function public.pre_screening_start(
  p_name text default null, p_ref text default null, p_browser text default null, p_caps text[] default null)
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
  -- v2: job (+ the follow-ups the AI adds after it) and medical, after the usual questions.
  if uid is not null and 'v2' = any(coalesce(p_caps, '{}'::text[]))
     and coalesce((cfg->>'v2')::boolean, false) and jsonb_typeof(cfg->'v2_questions') = 'array' then
    qs := qs || (cfg->'v2_questions');
  end if;
  vids := coalesce(app_private.pre_screening_videos(cfg), '[]'::jsonb);
  ask_proof := coalesce((cfg->>'proof')::boolean, true);

  if uid is not null and exists (select 1 from public.pre_screenings where user_id = uid and status <> 'open') then
    return jsonb_build_object('status', 'sent');
  end if;

  if clean_name is null then
    return jsonb_build_object('status', 'ready', 'video', vids->0->>'id', 'videos', vids, 'proof', ask_proof,
                              'questions', app_private.pre_screening_public_questions(qs),
                              'v2', jsonb_path_exists(qs, '$[*] ? (@.kind == "job")'));
  end if;
  if length(clean_name) < 2 then raise exception 'bad_name'; end if;

  if uid is not null then
    select * into mine from public.pre_screenings
     where user_id = uid and status = 'open' and created_at > now() - interval '20 hours'
     order by created_at desc limit 1;
    if mine.id is not null then
      return jsonb_build_object('status', 'open', 'token', mine.token, 'video', vids->0->>'id', 'videos', vids, 'proof', ask_proof,
                                'questions', app_private.pre_screening_public_questions(mine.questions),
                                'v2', jsonb_path_exists(mine.questions, '$[*] ? (@.kind == "job")'));
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
                            'questions', app_private.pre_screening_public_questions(new_row.questions),
                            'v2', jsonb_path_exists(new_row.questions, '$[*] ? (@.kind == "job")'));
end;
$$;

revoke all on function public.pre_screening_start(text, text, text, text[]) from public;
grant execute on function public.pre_screening_start(text, text, text, text[]) to anon, authenticated;

-- 5) The photo clock ---------------------------------------------------------------------------------
-- The page calls this when a photo ask is shown (and again on "Start again" after time ran out). The
-- server's clock, so a phone's clock can't stretch the 5 minutes. At most 6 per photo.
create or replace function public.pre_screening_photo_ask(p_token text, p_q text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.pre_screenings;
  stamps jsonb;
begin
  select * into s from public.pre_screenings where token = p_token for update;
  if s.id is null or s.status <> 'open' then raise exception 'bad_link'; end if;
  if not jsonb_path_exists(s.questions, '$[*] ? (@.id == $q && @.kind == "photo")', jsonb_build_object('q', p_q)) then
    raise exception 'bad_question';
  end if;
  stamps := coalesce(s.asks->p_q, '[]'::jsonb);
  if jsonb_array_length(stamps) >= 6 then raise exception 'too_many'; end if;
  update public.pre_screenings
     set asks = jsonb_set(asks, array[p_q], stamps || to_jsonb(now()))
   where id = s.id;
  return jsonb_build_object('asked_at', now(), 'seconds', 300, 'tries', jsonb_array_length(stamps) + 1);
end;
$$;

revoke all on function public.pre_screening_photo_ask(text, text) from public;
grant execute on function public.pre_screening_photo_ask(text, text) to anon, authenticated;

-- 6) Submit: photos, the certificate, coached answers, the medical choice ----------------------------
-- Same signature and checks as before for the usual answers. New per answer (all optional):
--   first, coach         the first try and the hint shown before they improved it (typed answers)
--   choice               medical: none | paid | future | ongoing
--   photo, source, taken_at, file_modified_at, alt, skip, skip_reason   (kind 'photo')
--   doc, doc_mime        (kind 'doc', optional)
-- Photos get asked_at (last server stamp before the upload), uploaded_at, late and tries from here,
-- never from the page.
create or replace function public.pre_screening_submit(
  p_token text, p_watched boolean, p_files jsonb, p_docs jsonb default '[]'::jsonb, p_videos integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.pre_screenings;
  q jsonb;
  f jsonb;
  d jsonb;
  clean jsonb := '[]'::jsonb;
  docs jsonb := '[]'::jsonb;
  path text;
  kind text;
  uploaded timestamptz;
  asked timestamptz;
  extra jsonb;
begin
  select * into s from public.pre_screenings where token = p_token for update;
  if s.id is null then raise exception 'bad_link'; end if;
  if s.status <> 'open' then return jsonb_build_object('status', 'done'); end if;
  if jsonb_typeof(p_files) <> 'array' then raise exception 'bad_files'; end if;
  if jsonb_typeof(coalesce(p_docs, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_docs, '[]'::jsonb)) > 6 then
    raise exception 'bad_docs';
  end if;

  for q in select * from jsonb_array_elements(s.questions) loop
    select x into f from jsonb_array_elements(p_files) x where x->>'q' = q->>'id' limit 1;
    kind := coalesce(q->>'kind', 'video');
    extra := '{}'::jsonb;

    if kind = 'photo' then
      if f is null or (f->>'photo' is null and coalesce((f->>'skip')::boolean, false) is not true) then
        raise exception 'missing_answer';
      end if;
      path := f->>'photo';
      uploaded := null;
      asked := null;
      if path is not null then
        if path not like s.token || '/%' then raise exception 'file_not_found'; end if;
        select o.created_at into uploaded from storage.objects o where o.bucket_id = 'pre-screenings' and o.name = path;
        if uploaded is null then raise exception 'file_not_found'; end if;
        select max(t.v::timestamptz) into asked
          from jsonb_array_elements_text(coalesce(s.asks->(q->>'id'), '[]'::jsonb)) t(v)
         where t.v::timestamptz <= uploaded + interval '5 seconds';
      end if;
      extra := jsonb_build_object(
        'photo', path,
        'source', case when f->>'source' in ('camera', 'file') then f->>'source' end,
        'taken_at', left(f->>'taken_at', 40),
        'file_modified_at', left(f->>'file_modified_at', 40),
        'alt', case when (f->>'alt')::boolean then true end,
        'skip', case when path is null then true end,
        'skip_reason', case when path is null then left(btrim(coalesce(f->>'skip_reason', '')), 200) end,
        'asked_at', asked,
        'uploaded_at', uploaded,
        'late', case when path is not null then asked is null or uploaded - asked > interval '5 minutes 30 seconds' end,
        'tries', jsonb_array_length(coalesce(s.asks->(q->>'id'), '[]'::jsonb)));
    elsif kind = 'doc' then
      path := f->>'doc';
      if path is null then
        if not coalesce((q->>'optional')::boolean, false) then raise exception 'missing_answer'; end if;
        clean := clean || jsonb_build_array(jsonb_build_object('q', q->>'id', 'skip', true));
        f := null;
        continue;
      end if;
      if path not like s.token || '/%'
         or not exists (select 1 from storage.objects o where o.bucket_id = 'pre-screenings' and o.name = path) then
        raise exception 'file_not_found';
      end if;
      extra := jsonb_build_object('doc', path, 'doc_mime', left(coalesce(f->>'doc_mime', ''), 60));
    else
      if f is null or (f->>'video' is null and f->>'audio' is null and length(btrim(coalesce(f->>'text', ''))) < 2) then
        if coalesce((q->>'optional')::boolean, false) then
          f := null;
          continue;
        end if;
        raise exception 'missing_answer';
      end if;
      foreach path in array array[f->>'video', f->>'audio'] loop
        if path is not null and (path not like s.token || '/%'
           or not exists (select 1 from storage.objects o where o.bucket_id = 'pre-screenings' and o.name = path)) then
          raise exception 'file_not_found';
        end if;
      end loop;
      extra := jsonb_build_object(
        'video', f->>'video', 'audio', f->>'audio',
        'seconds', least(greatest(coalesce((f->>'seconds')::numeric, 0), 0), 600),
        'text', nullif(left(btrim(coalesce(f->>'text', '')), 600), ''),
        'first', nullif(left(btrim(coalesce(f->>'first', '')), 600), ''),
        'coach', nullif(left(btrim(coalesce(f->>'coach', '')), 300), ''),
        'choice', case when kind = 'medical' and f->>'choice' in ('none', 'paid', 'future', 'ongoing') then f->>'choice' end);
    end if;

    clean := clean || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('q', q->>'id') || extra));
    f := null;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(p_docs, '[]'::jsonb)) loop
    path := d->>'path';
    if path is null or path not like s.token || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'pre-screenings' and o.name = path) then
      raise exception 'file_not_found';
    end if;
    docs := docs || jsonb_build_array(jsonb_build_object(
      'path', path,
      'name', left(coalesce(d->>'name', ''), 200),
      'mime', left(coalesce(d->>'mime', ''), 60),
      'size', greatest(coalesce((d->>'size')::bigint, 0), 0)));
  end loop;

  update public.pre_screenings
     set status = 'sent', answers = clean, income_files = docs, video_watched = coalesce(p_watched, false),
         videos_watched = case when p_videos is null then null else least(greatest(p_videos, 0), 20) end,
         sent_at = now()
   where id = s.id;
  perform app_private.pre_screening_call(jsonb_build_object('prescreen', s.id));
  return jsonb_build_object('status', 'done');
end;
$$;

revoke all on function public.pre_screening_submit(text, boolean, jsonb, jsonb, integer) from public;
grant execute on function public.pre_screening_submit(text, boolean, jsonb, jsonb, integer) to anon, authenticated;

-- 7) The new questions (switch off) -------------------------------------------------------------------
-- "good" = what a good answer looks like (the AI grades against it; edit any time without a deploy).
update public.telegram_bot_settings
   set value = (value::jsonb
     || jsonb_build_object('v2', coalesce(value::jsonb->'v2', 'false'::jsonb))
     || jsonb_build_object('v2_job_video', coalesce(value::jsonb->'v2_job_video', 'true'::jsonb))
     || jsonb_build_object('v2_questions', $json$[
  {"id": "job", "kind": "job", "min": 3,
   "text": "What is your job?",
   "hint": "Like farmer, teacher, Grab driver, sari-sari store",
   "good": "Names a real, specific job or business they do now. Weak: no job, only 'online', a job they used to have, or will not say."},
  {"id": "medical", "kind": "medical", "min": 2,
   "text": "Do you or your family have a medical problem?",
   "hint": "Type “no”, or what it is",
   "good": "Honest. 'No' is a full answer. Not counted in the score: graded separately as grade.medical."}
]$json$::jsonb))::text
 where key = 'prescreen_config';
