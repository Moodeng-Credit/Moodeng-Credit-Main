-- Proof of income, stricter from $40 and with two plain labels instead of one score.
--   authenticity   "is it real?": real / check / fake_signs (from the four fake-sign checks)
--   affordability  "can they afford it?": comfortable / tight / too_much / unknown, using the leanest
--                  month's earned income (loan-app money and own cash-ins left out) minus what they
--                  already pay other loan apps. afford_share = repayment ÷ that.
-- The 0–100 score is still stored so it can be tested against repayments later; the team no longer sees it.

alter table public.income_documents
  add column if not exists authenticity text check (authenticity in ('real', 'check', 'fake_signs')),
  add column if not exists affordability text check (affordability in ('comfortable', 'tight', 'too_much', 'unknown')),
  add column if not exists afford_share numeric;

-- Stricter steps (George, 2026-11-06): $40 needs a month of GCash/Maya/bank history (a payslip or
-- invoice alone goes back for history and never approves itself); $60+ also has them open GCash live
-- on a video call. Only changed if the team hasn't edited the steps since #1372.
update public.telegram_bot_settings
set value = '[{"min":40,"months":1,"fresh":false,"autoApprove":true,"maxShare":null,"balance":false,"liveCall":false},{"min":60,"months":2,"fresh":false,"autoApprove":false,"maxShare":0.5,"balance":false,"liveCall":true},{"min":100,"months":2,"fresh":true,"autoApprove":false,"maxShare":0.3,"balance":true,"liveCall":true},{"min":140,"months":2,"fresh":true,"autoApprove":false,"maxShare":0.3,"balance":true,"liveCall":true}]'
where key = 'income_doc_tiers'
  and value::jsonb = '[{"min":40,"months":0,"fresh":false,"autoApprove":true,"maxShare":null,"balance":false,"liveCall":false},{"min":60,"months":2,"fresh":false,"autoApprove":false,"maxShare":0.5,"balance":false,"liveCall":false},{"min":100,"months":2,"fresh":true,"autoApprove":false,"maxShare":0.3,"balance":true,"liveCall":false},{"min":140,"months":2,"fresh":true,"autoApprove":false,"maxShare":0.3,"balance":true,"liveCall":true}]'::jsonb;

-- Same as 20261102220000, plus their usual payday from the document (the day of the month the main
-- regular deposit lands), so the loan form can offer a due date just after payday.
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
        'approved', d.decision = 'approved',
        'payday', case when (d.metrics->'regular_deposits'->0->>'payday') ~ '^\d{1,2}$'
                       then (d.metrics->'regular_deposits'->0->>'payday')::int end
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

-- What happened after each read document: the first loan funded from a day before the send to 45
-- days after it, and whether it was repaid on time (by the end of the day after the due date), late,
-- or not yet. Admins only. The admin Income docs page groups these by label to test the checks.
create or replace function public.admin_income_doc_outcomes()
returns table (
  doc_id uuid,
  sent_at timestamptz,
  authenticity text,
  affordability text,
  score integer,
  verdict text,
  decision text,
  loan_amount numeric,
  due_date timestamptz,
  outcome text,
  days_late integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app_private.is_moodeng_admin() then raise exception 'admins only'; end if;
  return query
  select d.id, d.created_at, d.authenticity, d.affordability, d.score, d.verdict, d.decision,
         l.loan_amount, l.due_date,
         case
           when l.id is null then 'no_loan'
           when coalesce(l.repaid_at, l.offplatform_settled_at) is not null
                and coalesce(l.repaid_at, l.offplatform_settled_at) <= l.due_date + interval '1 day' then 'on_time'
           when coalesce(l.repaid_at, l.offplatform_settled_at) is not null then 'late'
           when l.due_date + interval '1 day' < now() then 'unpaid'
           else 'not_due'
         end,
         case
           when l.id is null then null
           else greatest(0, floor(extract(epoch from (coalesce(l.repaid_at, l.offplatform_settled_at, now()) - l.due_date)) / 86400))::int
         end
  from public.income_documents d
  left join lateral (
    select x.* from public.loans x
    where x.borrower_user_id = d.user_id
      and x.funded_at is not null
      and coalesce(x.is_test, false) = false
      and x.refunded_at is null
      and x.funded_at between d.created_at - interval '1 day' and d.created_at + interval '45 days'
    order by x.funded_at
    limit 1
  ) l on true
  where d.status = 'done'
  order by d.created_at desc;
end;
$$;

revoke all on function public.admin_income_doc_outcomes() from public;
grant execute on function public.admin_income_doc_outcomes() to authenticated;
