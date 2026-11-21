-- Pre-screening (optional): moodeng.app/screen/<affiliate code>. A link affiliates send people BEFORE
-- they sign up. No account needed: they type their name, watch the Moodeng video, then record a short
-- video answer to each of 3 questions. The clips go to the private pre-screenings bucket, the AI
-- (kyc-cross-check {"prescreen": id}, _shared/preScreening.ts) writes down what they said and grades
-- it, and the team gets a card. When the same browser later signs up, claim_pre_screening() ties the
-- result to the new account and the team is told "this sign-up was pre-screened".
--
-- It is never a requirement: nothing in onboarding checks it. The grade is advice for the team.
-- Switch: telegram_bot_settings.prescreen = on | off (off = the page says "closed").
-- Video + questions: telegram_bot_settings.prescreen_config (JSON), so they change without a deploy.

-- 1) Table -----------------------------------------------------------------------------------------
create table if not exists public.pre_screenings (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  ref_code text,
  name text not null,
  -- open → sent (clips in, AI working) → graded | failed
  status text not null default 'open' check (status in ('open', 'sent', 'graded', 'failed')),
  video_id text,
  video_watched boolean not null default false,
  -- The questions as they were asked: [{id, text, good}] ("good" = what a good answer sounds like).
  questions jsonb not null default '[]'::jsonb,
  -- [{q, video, audio, seconds}] — storage paths inside the pre-screenings bucket.
  answers jsonb not null default '[]'::jsonb,
  -- AI result: {overall, verdict, summary, answers: [{q, transcript, score, note}]}
  grade jsonb,
  score integer,
  verdict text check (verdict in ('good', 'ok', 'weak')),
  grade_error text,
  user_id uuid references public.users (id) on delete set null,
  claimed_at timestamptz,
  ip text,
  browser text,
  files_removed_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  graded_at timestamptz
);

create index if not exists pre_screenings_user_idx on public.pre_screenings (user_id) where user_id is not null;
create index if not exists pre_screenings_created_idx on public.pre_screenings (created_at desc);

alter table public.pre_screenings enable row level security;
revoke all on public.pre_screenings from anon, authenticated;
grant select on public.pre_screenings to authenticated;

drop policy if exists "admins read pre screenings" on public.pre_screenings;
create policy "admins read pre screenings" on public.pre_screenings
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- 2) Settings --------------------------------------------------------------------------------------
insert into public.telegram_bot_settings (key, value, description)
values
  ('prescreen', 'off', 'Pre-screening page moodeng.app/screen: on | off'),
  ('prescreen_daily_max', '40', 'Pre-screening: most new sessions per day (protects storage)'),
  ('prescreen_config',
   '{"video":"G4hibvp-T9g","questions":[{"id":"work","text":"What is your job, and how much do you earn in a month?","good":"Names a real, specific job or business and a believable monthly income. Vague, no income, or relying on someone else is weak."},{"id":"purpose","text":"What will you use your first loan for?","good":"A small, specific, sensible use they can explain (stock for a small business, a bill, load, transport). Weak: gambling, paying another loan, an emergency for a sick relative, or cannot say."},{"id":"repay","text":"When and how will you pay it back?","good":"Names where the money comes from (salary, payday, sales) and a clear time. Understands it must be repaid on time. Weak: no plan, hopes someone else pays, thinks it is free money."}]}',
   'Pre-screening: YouTube video id + the 3 questions and what a good answer sounds like (JSON)')
on conflict (key) do nothing;

-- 3) Bucket ----------------------------------------------------------------------------------------
-- Is this link still taking clips? (Used by the upload policy, so it must not need table access.)
-- p_token is 32 hex characters, so it is safe inside LIKE.
create or replace function app_private.pre_screening_open(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- At most 8 files per link (3 answers × video + sound, and a retry or two): the page is public and
  -- storage is small.
  select exists (
    select 1 from public.pre_screenings s
    where s.token = p_token and p_token ~ '^[0-9a-f]{32}$' and s.status = 'open' and s.created_at > now() - interval '1 day'
  ) and (
    select count(*) from storage.objects o
    where o.bucket_id = 'pre-screenings' and o.name like p_token || '/%'
  ) < 8;
$$;

revoke all on function app_private.pre_screening_open(text) from public;
grant execute on function app_private.pre_screening_open(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pre-screenings', 'pre-screenings', false, 20971520,
        array['video/mp4', 'video/webm', 'video/quicktime', 'audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;

drop policy if exists "pre screenings: upload to open link" on storage.objects;
create policy "pre screenings: upload to open link" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'pre-screenings' and app_private.pre_screening_open((storage.foldername(name))[1]));

drop policy if exists "pre screenings: admins read" on storage.objects;
create policy "pre screenings: admins read" on storage.objects
  for select to authenticated
  using (bucket_id = 'pre-screenings' and app_private.is_moodeng_admin());

-- 4) Helpers ---------------------------------------------------------------------------------------
create or replace function app_private.pre_screening_call(p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1)
      || '/functions/v1/kyc-cross-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := p_body,
    timeout_milliseconds := 150000
  );
end;
$$;

revoke all on function app_private.pre_screening_call(jsonb) from public, anon, authenticated;

-- The questions the page shows: id + text only (never the "good answer" notes).
create or replace function app_private.pre_screening_public_questions(p_questions jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', q->>'id', 'text', q->>'text')), '[]'::jsonb)
  from jsonb_array_elements(p_questions) q;
$$;

revoke all on function app_private.pre_screening_public_questions(jsonb) from public, anon, authenticated;

-- 5) The page --------------------------------------------------------------------------------------
-- Start (or check the switch with p_name = null). Returns {status:'closed'} | {status:'busy'} |
-- {status:'ready', video, questions} | {status:'open', token, video, questions}.
create or replace function public.pre_screening_start(p_name text default null, p_ref text default null, p_browser text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg jsonb;
  qs jsonb;
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

  if clean_name is null then
    return jsonb_build_object('status', 'ready', 'video', cfg->>'video',
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
  values (clean_name, clean_ref, cfg->>'video', qs, caller_ip, nullif(left(btrim(coalesce(p_browser, '')), 80), ''))
  returning * into new_row;

  return jsonb_build_object('status', 'open', 'token', new_row.token, 'video', new_row.video_id,
                            'questions', app_private.pre_screening_public_questions(new_row.questions));
end;
$$;

revoke all on function public.pre_screening_start(text, text, text) from public;
grant execute on function public.pre_screening_start(text, text, text) to anon, authenticated;

-- p_files: [{q, video, audio, seconds}] already uploaded to {token}/… . Every question needs a clip
-- (video, or at least the sound).
create or replace function public.pre_screening_submit(p_token text, p_watched boolean, p_files jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.pre_screenings;
  q jsonb;
  f jsonb;
  clean jsonb := '[]'::jsonb;
  path text;
begin
  select * into s from public.pre_screenings where token = p_token for update;
  if s.id is null then raise exception 'bad_link'; end if;
  if s.status <> 'open' then return jsonb_build_object('status', 'done'); end if;
  if jsonb_typeof(p_files) <> 'array' then raise exception 'bad_files'; end if;

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

  update public.pre_screenings
     set status = 'sent', answers = clean, video_watched = coalesce(p_watched, false), sent_at = now()
   where id = s.id;
  perform app_private.pre_screening_call(jsonb_build_object('prescreen', s.id));
  return jsonb_build_object('status', 'done');
end;
$$;

revoke all on function public.pre_screening_submit(text, boolean, jsonb) from public;
grant execute on function public.pre_screening_submit(text, boolean, jsonb) to anon, authenticated;

-- 6) Tie it to the account -------------------------------------------------------------------------
-- Called once after sign-in on the browser that did the pre-screening. First account wins; an account
-- keeps one pre-screening.
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
  if s.id is null or s.status = 'open' then return false; end if;
  if s.user_id is not null then return s.user_id = uid; end if;
  if exists (select 1 from public.pre_screenings where user_id = uid) then return false; end if;
  update public.pre_screenings set user_id = uid, claimed_at = now() where id = s.id;
  perform app_private.pre_screening_call(jsonb_build_object('prescreen_claimed', s.id));
  return true;
end;
$$;

revoke all on function public.claim_pre_screening(text) from public, anon;
grant execute on function public.claim_pre_screening(text) to authenticated;

-- 7) Team: grade again (after changing the questions, or when the AI failed) -----------------------
create or replace function public.regrade_pre_screening(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.is_moodeng_admin() then raise exception 'admins only'; end if;
  if not exists (select 1 from public.pre_screenings where id = p_id and status <> 'open') then raise exception 'not found'; end if;
  perform app_private.pre_screening_call(jsonb_build_object('prescreen', p_id, 'quiet', true));
end;
$$;

revoke all on function public.regrade_pre_screening(uuid) from public, anon;
grant execute on function public.regrade_pre_screening(uuid) to authenticated;
