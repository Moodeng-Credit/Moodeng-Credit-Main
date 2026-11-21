-- Pre-screening v2 (moodeng.app/screen): 3 short videos → 4 recorded answers → proof of income
-- (about 1 month, photos or PDF) → send. The AI then reads the document and reviews it together with
-- the answers (_shared/preScreening.ts). Builds on 20261116180000_pre_screening.sql.

-- 1) Columns ---------------------------------------------------------------------------------------
-- [{path, name, mime, size}] inside the pre-screenings bucket.
alter table public.pre_screenings add column if not exists income_files jsonb not null default '[]'::jsonb;
-- How many of the videos played to the end (video_watched = all of them).
alter table public.pre_screenings add column if not exists videos_watched integer;

-- 2) Bucket: documents too, and room for them ------------------------------------------------------
update storage.buckets
   set allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'audio/wav', 'audio/x-wav',
                                  'image/jpeg', 'image/png', 'image/webp', 'application/pdf']
 where id = 'pre-screenings';

create or replace function app_private.pre_screening_open(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- At most 24 files per link: 4 answers × video + sound, up to 6 proof-of-income files, and retries.
  select exists (
    select 1 from public.pre_screenings s
    where s.token = p_token and p_token ~ '^[0-9a-f]{32}$' and s.status = 'open' and s.created_at > now() - interval '1 day'
  ) and (
    select count(*) from storage.objects o
    where o.bucket_id = 'pre-screenings' and o.name like p_token || '/%'
  ) < 24;
$$;

-- 3) Start: the page gets the list of videos ------------------------------------------------------
-- The questions the page shows: id, text and the small line under it (never the "good answer" notes).
create or replace function app_private.pre_screening_public_questions(p_questions jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', q->>'id', 'text', q->>'text', 'hint', q->>'hint'))), '[]'::jsonb)
  from jsonb_array_elements(p_questions) q;
$$;

revoke all on function app_private.pre_screening_public_questions(jsonb) from public, anon, authenticated;

-- Config: {"videos":[{"id","title"}], "video": "<first id, for the old page>", "questions":[...]}.
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
    else '[]'::jsonb
  end;
$$;

revoke all on function app_private.pre_screening_videos(jsonb) from public, anon, authenticated;

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

  if clean_name is null then
    return jsonb_build_object('status', 'ready', 'video', vids->0->>'id', 'videos', vids,
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

  return jsonb_build_object('status', 'open', 'token', new_row.token, 'video', vids->0->>'id', 'videos', vids,
                            'questions', app_private.pre_screening_public_questions(new_row.questions));
end;
$$;

revoke all on function public.pre_screening_start(text, text, text) from public;
grant execute on function public.pre_screening_start(text, text, text) to anon, authenticated;

-- 4) Send: answers + proof of income --------------------------------------------------------------
-- p_files: [{q, video, audio, seconds}]; p_docs: [{path, name, mime, size}] (1–6, already uploaded to
-- {token}/…). p_videos: how many videos played to the end. The old 3-argument version (yesterday's
-- page) keeps working: it sends no documents.
drop function if exists public.pre_screening_submit(text, boolean, jsonb);

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
    if f is null or (f->>'video' is null and f->>'audio' is null) then raise exception 'missing_answer'; end if;
    foreach path in array array[f->>'video', f->>'audio'] loop
      if path is not null and (path not like s.token || '/%'
         or not exists (select 1 from storage.objects o where o.bucket_id = 'pre-screenings' and o.name = path)) then
        raise exception 'file_not_found';
      end if;
    end loop;
    clean := clean || jsonb_build_array(jsonb_build_object(
      'q', q->>'id', 'video', f->>'video', 'audio', f->>'audio',
      'seconds', least(greatest(coalesce((f->>'seconds')::numeric, 0), 0), 600)));
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

-- 5) The new videos + questions --------------------------------------------------------------------
-- The 3 one-minute videos approved borrowers already get (start, cash out, repay), then George's 4
-- questions. "good" = what a good answer sounds like (the AI grades against it; edit any time).
update public.telegram_bot_settings
   set value = $json${
  "video": "G4hibvp-T9g",
  "videos": [
    {"id": "G4hibvp-T9g", "title": "How to get started (6 simple steps)", "tall": true},
    {"id": "SMasdjEpDkg", "title": "How to cash out your loan"},
    {"id": "Eu9JzDMOSmw", "title": "How to repay in 1 minute"}
  ],
  "questions": [
    {"id": "intro", "text": "Introduce yourself in English.", "hint": "Your full name, age and job. If you are a student, what do you do for work?",
     "good": "Speaks in English (simple English is fine) and gives full name, age and a real job or business; a student also says what paid work they do. Weak: no English at all, no job and no work, under 18, or will not say."},
    {"id": "borrowed", "text": "Have you borrowed before, like Maya, Tala or Salmon?",
     "good": "Honest and specific: names the apps or lenders used and says they paid on time. Never borrowed before is fine. Weak: many loans at once, unpaid or late loans, or borrowing to pay other loans."},
    {"id": "purpose", "text": "What is this loan for?",
     "good": "A small, specific, sensible use they can explain (stock for a small business, a bill, load, transport, tools for work). Weak: gambling, paying another loan, an emergency for a sick relative, or cannot say."},
    {"id": "grow", "text": "How will you use the loan to build up your income?",
     "good": "Explains how the loan helps them earn or save (stock to sell, tools, transport to work, load for reselling) and how that money pays it back. Weak: no link to income, spending only, gambling, or thinks it is free money."}
  ]
}$json$
 where key = 'prescreen_config';
