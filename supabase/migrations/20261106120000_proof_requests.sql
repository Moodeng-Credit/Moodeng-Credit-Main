-- Proof requests: after a call, the team asks a new applicant to back up what they said — proof they
-- work at their company, their work visa abroad, their business permit, a couple of written answers —
-- and sends them one link (moodeng.app/proof/<token>). No sign-in, no automatic checks: they answer,
-- add photos/PDFs (or say why they can't), press Send, and the team reads it in Admin → People →
-- Proof requests.
--
--   create_proof_request()   admin: items (proof uploads + questions) + a short note → the link token;
--                            can also send the link on push / Messenger / Telegram right away
--   get_proof_request()      the page: what to send (anyone holding the token; marks it opened)
--   submit_proof_request()   the page: answers + uploaded files → pings the team
--   review_proof_request()   admin: "Looks good" or "Ask again" (with what's still missing — the link
--                            opens again and they're told on push / Messenger / Telegram)
--
-- Files go to the private proof-requests bucket under {token}/...; anyone with an OPEN link can upload
-- there, nobody but admins can read. Pings and messages ride on kyc-cross-check (edge function cap):
-- {"proof_request": id} = tell the team it came in, {"proof_request_send": id} = send the link.

-- 1) Table -----------------------------------------------------------------------------------------
create table if not exists public.proof_requests (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  user_id uuid not null references public.users(id) on delete cascade,
  -- [{id, kind: 'proof' | 'question', label, hint}]
  items jsonb not null,
  message text,                       -- a short note from the team shown at the top of the page
  status text not null default 'open' check (status in ('open', 'submitted', 'reviewed')),
  -- {item id: {text, missing}} — a question's answer, or for a proof: why they can't send it
  answers jsonb not null default '{}'::jsonb,
  files jsonb not null default '[]'::jsonb,   -- [{item, path, name, mime, size}]
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  sent_at timestamptz,                -- last time the link went out on push / Messenger / Telegram
  sent_via text[],
  opened_at timestamptz,
  submitted_at timestamptz,
  submit_count integer not null default 0,
  review text check (review in ('ok', 'ask_again')),
  review_note text,                   -- for 'ask_again': what's still missing, shown on the page
  reviewed_at timestamptz,
  reviewed_by text
);

create index if not exists proof_requests_user_idx on public.proof_requests (user_id, created_at desc);
create index if not exists proof_requests_status_idx on public.proof_requests (status, created_at desc);

alter table public.proof_requests enable row level security;

revoke all on public.proof_requests from anon, authenticated;
grant select on public.proof_requests to authenticated;

drop policy if exists "admins read proof requests" on public.proof_requests;
create policy "admins read proof requests" on public.proof_requests
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- Is this link still taking answers? (Used by the upload policy, so it must not need table access.)
create or replace function app_private.proof_request_open(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.proof_requests r
    where r.token = p_token and r.status = 'open' and r.expires_at > now()
  );
$$;

-- Only EXECUTE is needed: the policy below resolves the function when it's created, so anon never
-- needs USAGE on app_private (which would expose the schema's other functions by name).
revoke all on function app_private.proof_request_open(text) from public;
grant execute on function app_private.proof_request_open(text) to anon, authenticated;

-- 2) Bucket ----------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proof-requests', 'proof-requests', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "proof requests: upload to open link" on storage.objects;
create policy "proof requests: upload to open link" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'proof-requests' and app_private.proof_request_open((storage.foldername(name))[1]));

drop policy if exists "proof requests: admins read" on storage.objects;
create policy "proof requests: admins read" on storage.objects
  for select to authenticated
  using (bucket_id = 'proof-requests' and app_private.is_moodeng_admin());

-- Ask kyc-cross-check to do something for one request (team ping / send the link).
create or replace function app_private.proof_request_call(p_key text, p_id uuid)
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
    body := jsonb_build_object(p_key, p_id),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function app_private.proof_request_call(text, uuid) from public, anon, authenticated;

-- 3) The team asks ---------------------------------------------------------------------------------
-- p_items: [{id, kind, label, hint}], 1–10 of them. Returns {id, token}. p_send = also send the link to
-- them now (push / Messenger / Telegram, whichever they have).
create or replace function public.create_proof_request(
  p_user_id uuid,
  p_items jsonb,
  p_message text default null,
  p_send boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
  it jsonb;
  clean jsonb := '[]'::jsonb;
  row_id uuid;
  row_token text;
begin
  if not app_private.is_moodeng_admin() then raise exception 'admins only'; end if;
  if not exists (select 1 from public.users u where u.id = p_user_id) then raise exception 'user not found'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 10 then
    raise exception 'ask for 1 to 10 things';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if coalesce(it->>'kind', '') not in ('proof', 'question') or length(trim(coalesce(it->>'label', ''))) = 0
       or length(coalesce(it->>'id', '')) not between 1 and 40 then
      raise exception 'each item needs an id, a kind (proof or question) and a label';
    end if;
    clean := clean || jsonb_build_array(jsonb_build_object(
      'id', it->>'id',
      'kind', it->>'kind',
      'label', left(trim(it->>'label'), 140),
      'hint', nullif(left(trim(coalesce(it->>'hint', '')), 200), '')
    ));
  end loop;
  select coalesce(a.display_name, 'admin') into who from public.admin_users a where a.user_id = auth.uid() and a.active limit 1;

  insert into public.proof_requests (user_id, items, message, created_by)
  values (p_user_id, clean, nullif(left(trim(p_message), 500), ''), coalesce(who, 'admin'))
  returning id, token into row_id, row_token;

  if p_send then perform app_private.proof_request_call('proof_request_send', row_id); end if;
  return jsonb_build_object('id', row_id, 'token', row_token);
end;
$$;

revoke all on function public.create_proof_request(uuid, jsonb, text, boolean) from public;
grant execute on function public.create_proof_request(uuid, jsonb, text, boolean) to authenticated;

-- Send (or re-send) the link to them. Admins only.
create or replace function public.send_proof_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.is_moodeng_admin() then raise exception 'admins only'; end if;
  if not exists (select 1 from public.proof_requests where id = p_id) then raise exception 'not found'; end if;
  perform app_private.proof_request_call('proof_request_send', p_id);
end;
$$;

revoke all on function public.send_proof_request(uuid) from public;
grant execute on function public.send_proof_request(uuid) to authenticated;

-- 4) The page --------------------------------------------------------------------------------------
-- Anyone holding the token. Returns only what the page shows: their first name, the team's note, what
-- to send, where it stands, and their earlier answers (to edit after an "Ask again").
create or replace function public.get_proof_request(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.proof_requests;
  first_name text;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select * into r from public.proof_requests where token = p_token;
  if not found then return null; end if;
  if r.opened_at is null then
    update public.proof_requests set opened_at = now() where id = r.id;
  end if;
  select split_part(trim(coalesce(u.display_name, '')), ' ', 1) into first_name
  from public.users u where u.id = r.user_id;
  -- An initial ("G.") reads oddly in "Hi G.!" — leave the name out then.
  if length(regexp_replace(coalesce(first_name, ''), '[^[:alpha:]]', '', 'g')) < 2 then first_name := null; end if;

  return jsonb_build_object(
    'first_name', nullif(first_name, ''),
    'message', r.message,
    'items', r.items,
    'stage', case
      when r.status = 'open' and r.expires_at <= now() then 'expired'
      when r.status = 'open' then 'open'
      when r.status = 'submitted' then 'submitted'
      else 'done' end,
    'ask_again', case when r.status = 'open' and r.review = 'ask_again' then r.review_note end,
    'answers', r.answers,
    'file_counts', (
      select coalesce(jsonb_object_agg(item, n), '{}'::jsonb)
      from (select f->>'item' as item, count(*) as n from jsonb_array_elements(r.files) f group by 1) c
    ),
    'submitted_at', r.submitted_at
  );
end;
$$;

revoke all on function public.get_proof_request(text) from public;
grant execute on function public.get_proof_request(text) to anon, authenticated;

-- p_answers: {item id: {text, missing}}; p_files: [{item, path, name, mime, size}] already uploaded to
-- {token}/... . Every question needs an answer and every proof needs a file — new or from an earlier
-- send — or a reason they can't send it. New files are added to earlier ones (after an "Ask again").
create or replace function public.submit_proof_request(p_token text, p_answers jsonb, p_files jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.proof_requests;
  it jsonb;
  f jsonb;
  a jsonb;
  clean_answers jsonb := '{}'::jsonb;
  clean_files jsonb := '[]'::jsonb;
  item_ids text[];
begin
  select * into r from public.proof_requests where token = p_token for update;
  if not found then raise exception 'link not found'; end if;
  if r.status <> 'open' or r.expires_at <= now() then raise exception 'link closed'; end if;
  if jsonb_typeof(coalesce(p_files, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'bad answers';
  end if;
  if jsonb_array_length(r.files) + jsonb_array_length(coalesce(p_files, '[]'::jsonb)) > 30 then
    raise exception 'too many files';
  end if;
  select array_agg(i->>'id') into item_ids from jsonb_array_elements(r.items) i;

  for f in select * from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    if (f->>'path') not like p_token || '/%'
       or not ((f->>'item') = any(item_ids))
       or not exists (select 1 from storage.objects o where o.bucket_id = 'proof-requests' and o.name = f->>'path') then
      raise exception 'file not found';
    end if;
    clean_files := clean_files || jsonb_build_array(jsonb_build_object(
      'item', f->>'item', 'path', f->>'path', 'name', left(coalesce(f->>'name', 'file'), 200),
      'mime', f->>'mime', 'size', (f->>'size')::bigint
    ));
  end loop;
  clean_files := r.files || clean_files;

  for it in select * from jsonb_array_elements(r.items) loop
    a := p_answers->(it->>'id');
    if it->>'kind' = 'question' then
      if length(trim(coalesce(a->>'text', ''))) = 0 then raise exception 'answer every question'; end if;
      clean_answers := clean_answers || jsonb_build_object(it->>'id', jsonb_build_object('text', left(trim(a->>'text'), 1000)));
    elsif coalesce((a->>'missing')::boolean, false) then
      if length(trim(coalesce(a->>'text', ''))) = 0 then raise exception 'say why you can''t send it'; end if;
      clean_answers := clean_answers || jsonb_build_object(it->>'id', jsonb_build_object('missing', true, 'text', left(trim(a->>'text'), 1000)));
    else
      if not exists (select 1 from jsonb_array_elements(clean_files) x where x->>'item' = it->>'id') then
        raise exception 'add a file for every proof';
      end if;
      if length(trim(coalesce(a->>'text', ''))) > 0 then
        clean_answers := clean_answers || jsonb_build_object(it->>'id', jsonb_build_object('text', left(trim(a->>'text'), 1000)));
      end if;
    end if;
  end loop;

  update public.proof_requests
  set answers = clean_answers,
      files = clean_files,
      status = 'submitted',
      submitted_at = now(),
      submit_count = submit_count + 1
  where id = r.id;

  perform app_private.proof_request_call('proof_request', r.id);
end;
$$;

revoke all on function public.submit_proof_request(text, jsonb, jsonb) from public;
grant execute on function public.submit_proof_request(text, jsonb, jsonb) to anon, authenticated;

-- 5) The team reads it -----------------------------------------------------------------------------
-- 'ok' closes it. 'ask_again' opens the link again with what's still missing and tells them.
create or replace function public.review_proof_request(p_id uuid, p_review text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
begin
  if not app_private.is_moodeng_admin() then raise exception 'admins only'; end if;
  if p_review not in ('ok', 'ask_again') then raise exception 'ok or ask_again'; end if;
  if p_review = 'ask_again' and length(trim(coalesce(p_note, ''))) = 0 then raise exception 'say what is still missing'; end if;
  select coalesce(a.display_name, 'admin') into who from public.admin_users a where a.user_id = auth.uid() and a.active limit 1;

  update public.proof_requests
  set review = p_review,
      review_note = case when p_review = 'ask_again' then left(trim(p_note), 500) else nullif(left(trim(coalesce(p_note, '')), 500), '') end,
      reviewed_at = now(),
      reviewed_by = coalesce(who, 'admin'),
      status = case when p_review = 'ask_again' then 'open' else 'reviewed' end,
      expires_at = case when p_review = 'ask_again' then greatest(expires_at, now() + interval '7 days') else expires_at end
  where id = p_id;
  if not found then raise exception 'not found'; end if;

  if p_review = 'ask_again' then perform app_private.proof_request_call('proof_request_send', p_id); end if;
end;
$$;

revoke all on function public.review_proof_request(uuid, text, text) from public;
grant execute on function public.review_proof_request(uuid, text, text) to authenticated;
