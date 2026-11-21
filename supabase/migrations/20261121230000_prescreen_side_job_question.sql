-- Pre-screening (George 2026-11-21): "How will you use the loan to build up your income?" only made
-- sense for people with a business; everyone else made something up. It now asks about a side job or
-- small business, and "No" is a full answer.
update public.telegram_bot_settings
   set value = jsonb_set(value::jsonb, '{questions}', (
         select jsonb_agg(case q->>'id'
                  when 'grow' then q || jsonb_build_object(
                     'text', 'Do you also have a side job or small business?',
                     'hint', 'If yes, what is it? If no, just type "No".',
                     'min', 1,
                     'good', 'Says yes with a real side job or small business and what it is, or simply says no. "No" is fine and is not a weak answer. Weak: made-up or vague business, gambling or betting as a side job, or lending money to others.')
                  else q end order by ord)
         from jsonb_array_elements(value::jsonb->'questions') with ordinality t(q, ord)))::text
 where key = 'prescreen_config';
