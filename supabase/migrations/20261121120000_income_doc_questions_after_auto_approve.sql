-- Payslip questions at every credit step (George 2026-11-21): a proof of income that approved itself (the
-- small steps, decided_by 'auto …') still shows its questions on /documents and takes answers; a team
-- decision (Approve / Decline) closes them as before. Same functions as live, only that condition changes.

CREATE OR REPLACE FUNCTION public.get_my_income_document()
 RETURNS TABLE(id uuid, stage text, file_count integer, sent_at timestamp with time zone, decided_at timestamp with time zone, reason text, questions jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
         case when (d.decision is null or (d.decision = 'approved' and d.decided_by like 'auto%')) and d.verdict is distinct from 'resend' and jsonb_typeof(d.questions) = 'array' then (
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
$function$;

CREATE OR REPLACE FUNCTION public.save_income_doc_answer(p_doc uuid, p_user uuid, p_qid text, p_answer text, p_via text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  d public.income_documents;
  answer text := left(trim(coalesce(p_answer, '')), 500);
  remaining integer;
begin
  if answer = '' then raise exception 'empty answer'; end if;
  select * into d from public.income_documents where id = p_doc and user_id = p_user for update;
  -- Open while undecided, or approved by itself (a small step); a team decision closes it.
  if not found or (d.decision is not null and not (d.decision = 'approved' and coalesce(d.decided_by, '') like 'auto%'))
     or jsonb_typeof(d.questions) <> 'array' then return -1; end if;
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
$function$;
