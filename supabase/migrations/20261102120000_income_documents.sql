-- Income documents: a borrower sends proof of income (GCash / Maya history, bank statement, payslip —
-- photos or PDFs) from moodeng.app/documents. The team gets a Telegram + Discord ping right away to
-- look at it, and an AI read + rule checks land on the same row (Admin → Risk → Income docs).
--
-- One row per send (all its files together, so 3 screenshots of one history are read as one).
-- Files go to the private income-docs bucket under {user id}/...; the app then calls
-- submit_income_document(), which checks the paths, saves the row and pings kyc-cross-check with
-- {"income_doc": id} (folded in there: the project is at the edge function cap). The AI read uses
-- DeepSeek Flash with the DEEPSEEK_API_KEY edge secret check-loan-input already uses. No key = the
-- team still gets the ping, just without the AI read.
--
-- Borrowers never read results back: flags, score and memo are for the team only. They see only
-- where their latest send is (get_my_income_document): checking → in review → approved / declined.
-- An admin decides in Admin → Risk → Income docs (decide_income_document), which tells the borrower
-- on push, Messenger and Telegram through kyc-cross-check {"income_decision": id}.

-- 1) Table -----------------------------------------------------------------------------------------
create table if not exists public.income_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  files jsonb not null,               -- [{path, name, mime, size}]
  note text,                          -- what the borrower says it is (optional)
  -- pending → processing (AI reading) → done | failed | skipped (no AI key)
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed', 'skipped')),
  loan_id uuid,                       -- their open request/loan when it was read, for the affordability check
  doc_type text,
  file_hashes text[],
  row_keys text[],                    -- date|amount per transaction, to spot one history sent by two accounts
  extracted jsonb,
  metrics jsonb,
  flags jsonb not null default '[]'::jsonb,
  score integer,                      -- 0–100, rule-based; not calibrated until we have repayments to test it on
  memo text,
  ai_note text,
  risk text check (risk in ('green', 'orange', 'red')),
  model text,
  error text,
  created_at timestamptz not null default now(),
  analyzed_at timestamptz,
  decision text check (decision in ('approved', 'declined')),
  decision_reason text,               -- shown to the borrower when declined
  decided_at timestamptz,
  decided_by text,
  notified_at timestamptz
);

create index if not exists income_documents_user_idx on public.income_documents (user_id, created_at desc);
create index if not exists income_documents_hashes_idx on public.income_documents using gin (file_hashes);
create index if not exists income_documents_row_keys_idx on public.income_documents using gin (row_keys);

alter table public.income_documents enable row level security;

-- Only admins read. Borrowers write through submit_income_document() and read their status through
-- get_my_income_document(); admins decide through decide_income_document().
revoke all on public.income_documents from anon, authenticated;
grant select on public.income_documents to authenticated;

drop policy if exists "admins read income documents" on public.income_documents;
create policy "admins read income documents" on public.income_documents
  for select to authenticated
  using (app_private.is_moodeng_admin());


-- 2) Bucket ----------------------------------------------------------------------------------------
-- Borrowers can upload into their own folder but never list or read it back.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('income-docs', 'income-docs', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "income docs: upload own" on storage.objects;
create policy "income docs: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'income-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "income docs: admins read" on storage.objects;
create policy "income docs: admins read" on storage.objects
  for select to authenticated
  using (bucket_id = 'income-docs' and app_private.is_moodeng_admin());

-- 3) Submit ----------------------------------------------------------------------------------------
-- p_files: [{path, name, mime, size}] already uploaded. Every path must sit in the caller's folder
-- and exist in the bucket. At most 5 sends a day per borrower (each is a paid AI read).
create or replace function public.submit_income_document(p_files jsonb, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
  f jsonb;
begin
  if uid is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) not between 1 and 6 then
    raise exception 'send 1 to 6 files';
  end if;
  for f in select * from jsonb_array_elements(p_files) loop
    if (f->>'path') not like uid::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'income-docs' and o.name = f->>'path') then
      raise exception 'file not found';
    end if;
  end loop;
  if (select count(*) from public.income_documents where user_id = uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many sends today';
  end if;

  insert into public.income_documents (user_id, files, note)
  values (uid, p_files, nullif(left(trim(p_note), 300), ''))
  returning id into new_id;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1)
      || '/functions/v1/kyc-cross-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := jsonb_build_object('income_doc', new_id),
    timeout_milliseconds := 150000
  );
  return new_id;
end;
$$;

revoke all on function public.submit_income_document(jsonb, text) from public;
grant execute on function public.submit_income_document(jsonb, text) to authenticated;

-- 4) What the borrower sees -------------------------------------------------------------------------
-- Their latest send: stage = checking (AI still reading) | in_review | approved | declined.
create or replace function public.get_my_income_document()
returns table (id uuid, stage text, file_count integer, sent_at timestamptz, decided_at timestamptz, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id,
         case when d.decision is not null then d.decision
              when d.status in ('pending', 'processing') and d.created_at > now() - interval '5 minutes' then 'checking'
              else 'in_review' end,
         jsonb_array_length(d.files),
         d.created_at,
         d.decided_at,
         case when d.decision = 'declined' then d.decision_reason end
  from public.income_documents d
  where d.user_id = auth.uid()
  order by d.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_income_document() from public;
grant execute on function public.get_my_income_document() to authenticated;

-- 5) The team decides ------------------------------------------------------------------------------
-- Admins only. Saves the decision and has kyc-cross-check tell the borrower (push, Messenger,
-- Telegram). Deciding again (changed mind) tells them again.
create or replace function public.decide_income_document(p_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
begin
  if not app_private.is_moodeng_admin() then raise exception 'admins only'; end if;
  if p_decision not in ('approved', 'declined') then raise exception 'approved or declined'; end if;
  select coalesce(a.display_name, 'admin') into who from public.admin_users a where a.user_id = auth.uid() and a.active limit 1;

  update public.income_documents
  set decision = p_decision,
      decision_reason = case when p_decision = 'declined' then nullif(left(trim(p_reason), 300), '') end,
      decided_at = now(),
      decided_by = coalesce(who, 'admin'),
      notified_at = null
  where id = p_id;
  if not found then raise exception 'not found'; end if;

  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1)
      || '/functions/v1/kyc-cross-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := jsonb_build_object('income_decision', p_id),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.decide_income_document(uuid, text, text) from public;
grant execute on function public.decide_income_document(uuid, text, text) to authenticated;
