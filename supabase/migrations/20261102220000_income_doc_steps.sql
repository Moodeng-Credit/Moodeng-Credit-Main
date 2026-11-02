-- Proof of income in steps that follow the credit ladder: the more someone asks for, the more we
-- need. The steps live in telegram_bot_settings.income_doc_tiers (JSON, edit without a deploy;
-- '[]' turns proof of income off). Each step applies from `min` USD up to the next step:
--   months      history the document must cover (0 = any recent one)
--   fresh       a new document for each loan (sent after their last funded loan, within 14 days)
--   autoApprove approved automatically when every check passes (fraud signs still go to the team)
--   maxShare    repayment as a share of monthly income above which it's flagged
--   balance     average balance must cover the repayment (flagged if not)
--   liveCall    remind the team to have them show GCash live on the call
-- Replaces income_doc_min_usd (the single $60 line), which is no longer read.

insert into public.telegram_bot_settings (key, value, description)
values (
  'income_doc_tiers',
  '[{"min":40,"months":0,"fresh":false,"autoApprove":true,"maxShare":null,"balance":false,"liveCall":false},{"min":60,"months":2,"fresh":false,"autoApprove":false,"maxShare":0.5,"balance":false,"liveCall":false},{"min":100,"months":2,"fresh":true,"autoApprove":false,"maxShare":0.3,"balance":true,"liveCall":false},{"min":140,"months":2,"fresh":true,"autoApprove":false,"maxShare":0.3,"balance":true,"liveCall":true}]',
  'Proof-of-income steps by loan amount (JSON). [] = off. See migration 20261102220000.'
)
on conflict (key) do nothing;

-- What they were asking for when they sent it (from the loan form), so the checks use the right step
-- and the affordability check works before the request exists.
alter table public.income_documents
  add column if not exists requested_amount numeric,
  add column if not exists requested_repay numeric,
  add column if not exists tier jsonb;

-- Submit now carries the amount they're asking for (optional: /documents opened on its own has none).
drop function if exists public.submit_income_document(jsonb, text);
create or replace function public.submit_income_document(
  p_files jsonb,
  p_note text default null,
  p_amount numeric default null,
  p_repay numeric default null
)
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

  insert into public.income_documents (user_id, files, note, requested_amount, requested_repay)
  values (
    uid, p_files, nullif(left(trim(p_note), 300), ''),
    case when p_amount > 0 and p_amount < 100000 then p_amount end,
    case when p_repay > 0 and p_repay < 100000 then p_repay end
  )
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

revoke all on function public.submit_income_document(jsonb, text, numeric, numeric) from public;
grant execute on function public.submit_income_document(jsonb, text, numeric, numeric) to authenticated;

-- What the loan form needs to decide, for any amount, whether this borrower's proof is enough
-- (src/lib/incomeDocSteps.ts does the deciding): the steps, their latest usable send in the last 90
-- days (not declined, not sent back to fix) with how many months it covered once read, and when their
-- last loan was funded (for "fresh" steps). Returns the old shape's keys too, so an old app build
-- reads it as "no requirement" instead of breaking.
create or replace function public.get_income_doc_requirement()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tiers', coalesce((select value::jsonb from public.telegram_bot_settings where key = 'income_doc_tiers'), '[]'::jsonb),
    'doc', (
      select jsonb_build_object(
        'created_at', d.created_at,
        'months', (d.metrics->>'months_covered')::numeric,
        'read', d.status in ('done', 'failed', 'skipped'),
        'approved', d.decision = 'approved'
      )
      from public.income_documents d
      where d.user_id = auth.uid()
        and d.created_at > now() - interval '90 days'
        and d.decision is distinct from 'declined'
        and (d.decision = 'approved' or d.verdict is distinct from 'resend')
      order by d.created_at desc
      limit 1
    ),
    'last_funded_at', (
      select max(l.funded_at) from public.loans l
      where l.borrower_user_id = auth.uid() and l.funded_at is not null and coalesce(l.is_test, false) = false
    ),
    'min_usd', null,
    'ok', true
  );
$$;

revoke all on function public.get_income_doc_requirement() from public;
grant execute on function public.get_income_doc_requirement() to authenticated;
