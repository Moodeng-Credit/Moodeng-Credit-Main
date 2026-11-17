-- Pre-screening: typed answers (affiliate feedback 2026-11-17: recording every answer takes too long and
-- words get lost). Question 1 (introduce yourself in English) stays a short video; 2-4 are typed.
-- Questions carry "kind": "text" | "video" (no kind = video). A typed answer is saved as answers[].text
-- and graded as written (no speech-to-text).

create or replace function app_private.pre_screening_public_questions(p_questions jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', q->>'id', 'text', q->>'text', 'hint', q->>'hint', 'kind', q->>'kind'))), '[]'::jsonb)
  from jsonb_array_elements(p_questions) q;
$$;

revoke all on function app_private.pre_screening_public_questions(jsonb) from public, anon, authenticated;

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
    if f is null or (f->>'video' is null and f->>'audio' is null and length(btrim(coalesce(f->>'text', ''))) < 2) then
      raise exception 'missing_answer';
    end if;
    foreach path in array array[f->>'video', f->>'audio'] loop
      if path is not null and (path not like s.token || '/%'
         or not exists (select 1 from storage.objects o where o.bucket_id = 'pre-screenings' and o.name = path)) then
        raise exception 'file_not_found';
      end if;
    end loop;
    clean := clean || jsonb_build_array(jsonb_build_object(
      'q', q->>'id', 'video', f->>'video', 'audio', f->>'audio',
      'seconds', least(greatest(coalesce((f->>'seconds')::numeric, 0), 0), 600),
      'text', nullif(left(btrim(coalesce(f->>'text', '')), 600), '')));
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

update public.telegram_bot_settings
   set value = jsonb_set(value::jsonb, '{questions}', (
         select jsonb_agg(case when q->>'id' in ('borrowed', 'purpose', 'grow') then q || '{"kind":"text"}'::jsonb else q end)
         from jsonb_array_elements(value::jsonb->'questions') q))::text
 where key = 'prescreen_config';
