-- Pre-screening: a stopped send says WHICH answer, so the page can explain it and take them there.
-- Same function as 20261128070000 (money questions never block); the errors keep their messages
-- (old pages and the logs read those) and add a DETAIL PostgREST returns as `details`:
--   missing_answer / file_not_found  → 'q:<question id>'
--   file_not_found (income files) / bad_docs → 'proof'
-- The page (src/app/screen/page.tsx) then asks check-loan-input {kind:'prescreen_send_help'} for the
-- latest questions + one plain sentence on what happened, and jumps to that question.

create or replace function public.pre_screening_submit(p_token text, p_watched boolean, p_files jsonb, p_docs jsonb default '[]'::jsonb, p_videos integer default null::integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  s public.pre_screenings;
  q jsonb;
  f jsonb;
  d jsonb;
  clean jsonb := '[]'::jsonb;
  docs jsonb := '[]'::jsonb;
  dropped text[] := '{}';
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
    raise exception 'bad_docs' using detail = 'proof';
  end if;

  for q in select * from jsonb_array_elements(s.questions) loop
    select x into f from jsonb_array_elements(p_files) x where x->>'q' = q->>'id' limit 1;
    kind := coalesce(q->>'kind', 'video');
    extra := '{}'::jsonb;

    if kind = 'photo' then
      if f is null or (f->>'photo' is null and coalesce((f->>'skip')::boolean, false) is not true) then
        raise exception 'missing_answer' using detail = 'q:' || (q->>'id');
      end if;
      path := f->>'photo';
      uploaded := null;
      asked := null;
      if path is not null then
        if path not like s.token || '/%' then raise exception 'file_not_found' using detail = 'q:' || (q->>'id'); end if;
        select o.created_at into uploaded from storage.objects o where o.bucket_id = 'pre-screenings' and o.name = path;
        if uploaded is null then raise exception 'file_not_found' using detail = 'q:' || (q->>'id'); end if;
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
        if not coalesce((q->>'optional')::boolean, false) then raise exception 'missing_answer' using detail = 'q:' || (q->>'id'); end if;
        clean := clean || jsonb_build_array(jsonb_build_object('q', q->>'id', 'skip', true));
        f := null;
        continue;
      end if;
      if path not like s.token || '/%'
         or not exists (select 1 from storage.objects o where o.bucket_id = 'pre-screenings' and o.name = path) then
        raise exception 'file_not_found' using detail = 'q:' || (q->>'id');
      end if;
      extra := jsonb_build_object('doc', path, 'doc_mime', left(coalesce(f->>'doc_mime', ''), 60));
    else
      if f is null or (f->>'video' is null and f->>'audio' is null and length(btrim(coalesce(f->>'text', ''))) < 2) then
        if coalesce((q->>'optional')::boolean, false) then
          f := null;
          continue;
        end if;
        -- Money questions fail open on the page, so they never block here either.
        if q->>'id' ~ '^money_q' then
          dropped := dropped || (q->>'id');
          f := null;
          continue;
        end if;
        raise exception 'missing_answer' using detail = 'q:' || (q->>'id');
      end if;
      foreach path in array array[f->>'video', f->>'audio'] loop
        if path is not null and (path not like s.token || '/%'
           or not exists (select 1 from storage.objects o where o.bucket_id = 'pre-screenings' and o.name = path)) then
          raise exception 'file_not_found' using detail = 'q:' || (q->>'id');
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
      raise exception 'file_not_found' using detail = 'proof';
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
         questions = case when cardinality(dropped) = 0 then questions else
           coalesce((select jsonb_agg(x order by n) from jsonb_array_elements(questions) with ordinality t(x, n)
                      where not (x->>'id' = any(dropped))), '[]'::jsonb) end,
         sent_at = now()
   where id = s.id;
  perform app_private.pre_screening_call(jsonb_build_object('prescreen', s.id));
  return jsonb_build_object('status', 'done');
end;
$function$;
