-- Pre-screening: every answer is saved on the server the moment it's given (George 2026-11-27).
-- Before, answers lived only on the phone until the final Send: a reload, a second copy of the page in
-- Messenger, or a new phone lost them, and the send was stopped (one borrower, 18 tries).
--   pre_screening_save  — one answer (+ the question text it answered), the proof files, videos watched,
--                         or drop one answer. Same token rule as pre_screening_submit.
--   pre_screening_submit — a question the phone didn't send is filled from the saved answer, but only if
--                         it answered the same question text (a new job plan reuses ids like job_q1).
--                         Proof files and videos watched fall back to the saved ones too.
--   pre_screening_start — reopening an open pre-screening returns the saved answers, so a new phone or a
--                         cleared page picks up where they left off.

alter table public.pre_screenings
   add column if not exists draft_answers jsonb not null default '{}'::jsonb,
   add column if not exists draft_docs jsonb,
   add column if not exists draft_videos integer,
   add column if not exists draft_at timestamptz;

comment on column public.pre_screenings.draft_answers is 'Answers saved as they go (pre_screening_save): {question id: answer + _text}; the final send fills gaps from here.';
comment on column public.pre_screenings.draft_at is 'Last answer saved: where people stop.';

create or replace function public.pre_screening_save(
   p_token text,
   p_answer jsonb default null,
   p_docs jsonb default null,
   p_videos integer default null,
   p_drop text default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  s public.pre_screenings;
  q jsonb;
  d jsonb;
  qid text;
  docs jsonb := '[]'::jsonb;
  v_answers jsonb;
  saved_docs jsonb;
begin
  select * into s from public.pre_screenings where token = p_token for update;
  if s.id is null then raise exception 'bad_link'; end if;
  if s.status <> 'open' then return jsonb_build_object('status', 'done'); end if;
  v_answers := coalesce(s.draft_answers, '{}'::jsonb);
  saved_docs := s.draft_docs;

  if p_drop is not null then
    v_answers := v_answers - left(p_drop, 40);
  end if;

  if jsonb_typeof(p_answer) = 'object' then
    qid := left(p_answer->>'q', 40);
    select x into q from jsonb_array_elements(s.questions) x where x->>'id' = qid limit 1;
    if q is not null then
      v_answers := v_answers || jsonb_build_object(qid, jsonb_strip_nulls(jsonb_build_object(
        'q', qid,
        'video', left(p_answer->>'video', 200),
        'audio', left(p_answer->>'audio', 200),
        'seconds', case when jsonb_typeof(p_answer->'seconds') = 'number' then least(greatest((p_answer->>'seconds')::numeric, 0), 600) end,
        'text', left(p_answer->>'text', 600),
        'first', left(p_answer->>'first', 600),
        'coach', left(p_answer->>'coach', 300),
        'choice', left(p_answer->>'choice', 20),
        'photo', left(p_answer->>'photo', 200),
        'source', left(p_answer->>'source', 10),
        'taken_at', left(p_answer->>'taken_at', 40),
        'file_modified_at', left(p_answer->>'file_modified_at', 40),
        'alt', case when p_answer->>'alt' = 'true' then true end,
        'skip', case when p_answer->>'skip' = 'true' then true end,
        'skip_reason', left(p_answer->>'skip_reason', 200),
        'doc', left(p_answer->>'doc', 200),
        'doc_mime', left(p_answer->>'doc_mime', 60),
        '_text', q->>'text')));
    end if;
  end if;

  if jsonb_typeof(p_docs) = 'array' and jsonb_array_length(p_docs) <= 6 then
    for d in select * from jsonb_array_elements(p_docs) loop
      if jsonb_typeof(d) = 'object' and d->>'path' is not null then
        docs := docs || jsonb_build_array(jsonb_build_object(
          'path', left(d->>'path', 200),
          'name', left(coalesce(d->>'name', ''), 200),
          'mime', left(coalesce(d->>'mime', ''), 60),
          'size', case when jsonb_typeof(d->'size') = 'number' then greatest((d->>'size')::numeric, 0)::bigint else 0 end));
      end if;
    end loop;
    saved_docs := docs;
  end if;

  update public.pre_screenings
     set draft_answers = v_answers,
         draft_docs = saved_docs,
         draft_videos = case when p_videos is null then draft_videos
                             else greatest(coalesce(draft_videos, 0), least(greatest(p_videos, 0), 20)) end,
         draft_at = now()
   where id = s.id;
  return jsonb_build_object('status', 'saved');
end;
$function$;

revoke all on function public.pre_screening_save(text, jsonb, jsonb, integer, text) from public;
grant execute on function public.pre_screening_save(text, jsonb, jsonb, integer, text) to anon, authenticated, service_role;

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
  saved jsonb;
  clean jsonb := '[]'::jsonb;
  docs jsonb := '[]'::jsonb;
  in_docs jsonb;
  dropped text[] := '{}';
  path text;
  kind text;
  uploaded timestamptz;
  asked timestamptz;
  extra jsonb;
  watched_n integer;
  video_n integer;
begin
  select * into s from public.pre_screenings where token = p_token for update;
  if s.id is null then raise exception 'bad_link'; end if;
  if s.status <> 'open' then return jsonb_build_object('status', 'done'); end if;
  if jsonb_typeof(p_files) <> 'array' then raise exception 'bad_files'; end if;
  -- No files from the phone (a new phone, a lost page): the ones saved as they went.
  in_docs := coalesce(p_docs, '[]'::jsonb);
  if jsonb_typeof(in_docs) = 'array' and jsonb_array_length(in_docs) = 0 and jsonb_typeof(s.draft_docs) = 'array' then
    in_docs := s.draft_docs;
  end if;
  if jsonb_typeof(in_docs) <> 'array' or jsonb_array_length(in_docs) > 6 then
    raise exception 'bad_docs' using detail = 'proof';
  end if;

  for q in select * from jsonb_array_elements(s.questions) loop
    select x into f from jsonb_array_elements(p_files) x where x->>'q' = q->>'id' limit 1;
    -- Not on the phone: the answer saved as they went, if it answered this same question.
    if f is null then
      saved := s.draft_answers->(q->>'id');
      if saved is not null and saved->>'_text' is not distinct from q->>'text' then
        f := saved - '_text';
      end if;
    end if;
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

  for d in select * from jsonb_array_elements(in_docs) loop
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

  -- Videos watched: the most either the phone or the saved progress says.
  watched_n := greatest(coalesce(p_videos, 0), coalesce(s.draft_videos, 0));
  video_n := coalesce(array_length(string_to_array(nullif(s.video_id, ''), ','), 1), 0);

  update public.pre_screenings
     set status = 'sent', answers = clean, income_files = docs,
         video_watched = coalesce(p_watched, false) or (video_n > 0 and watched_n >= video_n),
         videos_watched = case when p_videos is null and s.draft_videos is null then null else least(greatest(watched_n, 0), 20) end,
         questions = case when cardinality(dropped) = 0 then questions else
           coalesce((select jsonb_agg(x order by n) from jsonb_array_elements(questions) with ordinality t(x, n)
                      where not (x->>'id' = any(dropped))), '[]'::jsonb) end,
         sent_at = now()
   where id = s.id;
  perform app_private.pre_screening_call(jsonb_build_object('prescreen', s.id));
  return jsonb_build_object('status', 'done');
end;
$function$;

create or replace function public.pre_screening_start(p_name text default null::text, p_ref text default null::text, p_browser text default null::text, p_caps text[] default null::text[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
      -- Picking up where they left off (another phone, a cleared page): the answers saved so far that
      -- still match their question, the proof files, and how many videos they watched.
      return jsonb_build_object('status', 'open', 'token', mine.token, 'video', vids->0->>'id', 'videos', vids, 'proof', ask_proof,
                                'questions', app_private.pre_screening_public_questions(mine.questions),
                                'v2', jsonb_path_exists(mine.questions, '$[*] ? (@.kind == "job")'),
                                'draft', coalesce((select jsonb_agg(e.value - '_text') from jsonb_each(mine.draft_answers) e
                                                    where exists (select 1 from jsonb_array_elements(mine.questions) x
                                                                   where x->>'id' = e.key and x->>'text' is not distinct from e.value->>'_text')), '[]'::jsonb),
                                'draft_docs', mine.draft_docs,
                                'draft_videos', mine.draft_videos);
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
$function$;
