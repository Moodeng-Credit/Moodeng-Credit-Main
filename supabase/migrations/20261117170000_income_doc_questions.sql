-- Proof of income: the AI's questions go to the borrower, not just the team.
--
-- After the checks, the AI opinion can come with up to 2 questions for the team. analyseIncomeDocument
-- (supabase/functions/_shared/incomeDocs.ts) now also rewrites them for the borrower (short, friendly,
-- English + Taglish / Bahasa Indonesia, no hint of suspicion) into income_documents.questions.
-- They answer on moodeng.app/documents right after the check, or on Messenger (type DOCS to the Page;
-- _shared/messengerIncomeDocReply.ts). When every question has an answer, kyc-cross-check
-- {"income_answers": id} runs the AI opinion again with the answers and posts it under the team ping.

alter table public.income_documents
  add column if not exists questions jsonb,                 -- [{id, team, en, local, kind: 'text'|'file'}]
  add column if not exists answers jsonb not null default '[]'::jsonb, -- [{id, a, at, via: 'page'|'messenger'}]
  add column if not exists answers_reviewed_at timestamptz, -- the AI re-read with the answers (once)
  add column if not exists messenger_asked_at timestamptz,  -- the Messenger bot is waiting for an answer to…
  add column if not exists messenger_asked_id text,         -- …this question
  add column if not exists messenger_confirmed_at timestamptz; -- they typed DOCS to the Page about this send

-- The question in their language: English if they chose it in the Messenger menu, else Bahasa for
-- Indonesia / Taglish for 'fil', else English.
create or replace function public.income_doc_question_text(p_question jsonb, p_locale text, p_market text)
returns text
language sql
immutable
set search_path to ''
as $$
  select coalesce(
    case when p_locale = 'en' then null
         when p_market = 'ID' or p_locale = 'fil' then nullif(trim(p_question->>'local'), '') end,
    p_question->>'en'
  );
$$;

-- Same as before plus `questions`: the ones still unanswered, in their language, while the send waits
-- for the team (no decision, not a resend ask). Return type changes, so drop and recreate.
drop function if exists public.get_my_income_document();
create function public.get_my_income_document()
returns table(id uuid, stage text, file_count integer, sent_at timestamptz, decided_at timestamptz, reason text, questions jsonb)
language sql
stable
security definer
set search_path to ''
as $$
  select d.id,
         case when d.decision is not null then d.decision
              when d.verdict = 'resend' then 'resend'
              when d.status in ('pending', 'processing') and d.created_at > now() - interval '5 minutes' then 'checking'
              else 'in_review' end,
         jsonb_array_length(d.files),
         d.created_at,
         d.decided_at,
         case when d.decision = 'declined' then d.decision_reason
              when d.decision is null and d.verdict = 'resend' then d.resend_reason end,
         case when d.decision is null and d.verdict is distinct from 'resend' and jsonb_typeof(d.questions) = 'array' then (
           select coalesce(jsonb_agg(jsonb_build_object(
                    'id', q->>'id',
                    'q', public.income_doc_question_text(q, u.preferred_locale, u.market),
                    'kind', coalesce(q->>'kind', 'text')
                  ) order by ord), '[]'::jsonb)
           from jsonb_array_elements(d.questions) with ordinality as t(q, ord)
           where not exists (select 1 from jsonb_array_elements(d.answers) a where a->>'id' = q->>'id')
         ) else '[]'::jsonb end
  from public.income_documents d
  left join public.users u on u.id = d.user_id
  where d.user_id = auth.uid()
  order by d.created_at desc
  limit 1;
$$;
revoke all on function public.get_my_income_document() from public;
grant execute on function public.get_my_income_document() to authenticated;

-- One answer, from the page or the Messenger bot. Returns how many questions are still open, or -1 when
-- it wasn't taken (not theirs, already decided, unknown question). The last answer starts the AI re-read.
create or replace function public.save_income_doc_answer(p_doc uuid, p_user uuid, p_qid text, p_answer text, p_via text)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  d public.income_documents;
  answer text := left(trim(coalesce(p_answer, '')), 500);
  remaining integer;
begin
  if answer = '' then raise exception 'empty answer'; end if;
  select * into d from public.income_documents where id = p_doc and user_id = p_user for update;
  if not found or d.decision is not null or jsonb_typeof(d.questions) <> 'array' then return -1; end if;
  if not exists (select 1 from jsonb_array_elements(d.questions) q where q->>'id' = p_qid) then return -1; end if;

  if not exists (select 1 from jsonb_array_elements(d.answers) a where a->>'id' = p_qid) then
    d.answers := d.answers || jsonb_build_array(jsonb_build_object(
      'id', p_qid, 'a', answer, 'at', now(), 'via', case when p_via = 'messenger' then 'messenger' else 'page' end));
  end if;
  select count(*) into remaining
  from jsonb_array_elements(d.questions) q
  where not exists (select 1 from jsonb_array_elements(d.answers) a where a->>'id' = q->>'id');

  update public.income_documents
  set answers = d.answers,
      -- The bot stops waiting once its question is answered (here or on the page).
      messenger_asked_at = case when remaining = 0 or messenger_asked_id = p_qid then null else messenger_asked_at end,
      messenger_asked_id = case when remaining = 0 or messenger_asked_id = p_qid then null else messenger_asked_id end
  where id = p_doc;

  if remaining = 0 and d.answers_reviewed_at is null then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1)
        || '/functions/v1/kyc-cross-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
      ),
      body := jsonb_build_object('income_answers', p_doc),
      timeout_milliseconds := 150000
    );
  end if;
  return remaining;
end;
$$;
revoke all on function public.save_income_doc_answer(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.save_income_doc_answer(uuid, uuid, text, text, text) to service_role;

-- The borrower's own answer from moodeng.app/documents.
create or replace function public.answer_my_income_doc_question(p_doc uuid, p_qid text, p_answer text)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return public.save_income_doc_answer(p_doc, auth.uid(), p_qid, p_answer, 'page');
end;
$$;
revoke all on function public.answer_my_income_doc_question(uuid, text, text) from public, anon;
grant execute on function public.answer_my_income_doc_question(uuid, text, text) to authenticated;
