-- Pre-screening (George 2026-11-17): "No" is a full answer to "Have you borrowed before?". Each typed
-- question can say how long its answer must be ("min" characters, default 15 on the page), and the
-- longer ones get a hint saying so. The page receives "min" with the question.
create or replace function app_private.pre_screening_public_questions(p_questions jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', q->>'id', 'text', q->>'text', 'hint', q->>'hint', 'kind', q->>'kind', 'min', q->'min'))), '[]'::jsonb)
  from jsonb_array_elements(p_questions) q;
$$;

revoke all on function app_private.pre_screening_public_questions(jsonb) from public, anon, authenticated;

update public.telegram_bot_settings
   set value = jsonb_set(value::jsonb, '{questions}', (
         select jsonb_agg(case q->>'id'
                  when 'borrowed' then q || '{"min": 1, "hint": "If yes, which ones, and did you pay on time?"}'::jsonb
                  when 'purpose' then q || '{"hint": "1 or 2 sentences"}'::jsonb
                  when 'grow' then q || '{"hint": "1 or 2 sentences"}'::jsonb
                  else q end order by ord)
         from jsonb_array_elements(value::jsonb->'questions') with ordinality t(q, ord)))::text
 where key = 'prescreen_config';
