-- Proof of income → credit ladder, read properly (George, 2026-11-27).
--
-- 1. The monthly amount is read like the document checks read it: net pay (a payslip's net pay scaled to a
--    full month by the period it covers: a ₱9k half-month payslip ≈ ₱18k), else the biggest regular
--    deposit, else money in per month. It used to take the biggest of net pay and money in, unscaled.
--    Mirrors supabase/functions/_shared/incomeLadder.ts docMonthlyPhp.
-- 2. Only a team-approved PHP document from the last 3 months counts (its period end, else when it was
--    sent), and the most recent one wins. Old proof no longer counts forever.
-- Thresholds unchanged: ≥ ₱23,000 → no $60 top ($140) · ≥ ₱12,000 → $60 · less → $35.

create or replace function app_private.income_doc_monthly_php(p_metrics jsonb, p_currency text)
returns numeric
language sql
immutable
set search_path to ''
as $function$
  select case
    when coalesce(upper(p_currency), 'PHP') <> 'PHP' then null
    when coalesce(nullif(p_metrics->>'net_pay', '')::numeric, 0) > 0 then round(
      (p_metrics->>'net_pay')::numeric / case
        when coalesce(nullif(p_metrics->>'months_covered', '')::numeric, 0) between 0.2 and 3
          then (p_metrics->>'months_covered')::numeric
        else 1 end)
    when coalesce(nullif(p_metrics->'regular_deposits'->0->>'amount', '')::numeric, 0) > 0
      then round((p_metrics->'regular_deposits'->0->>'amount')::numeric)
    when coalesce(nullif(p_metrics->>'monthly_in', '')::numeric, 0) > 0
      then round((p_metrics->>'monthly_in')::numeric)
    else null
  end;
$function$;

create or replace function app_private.limit_ceiling(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with team as (
    select c.ceiling_usd from public.borrower_limit_ceilings c where c.user_id = p_user
  ),
  doc as (
    select app_private.income_doc_monthly_php(d.metrics, d.extracted->>'currency') as php
    from public.income_documents d
    where d.user_id = p_user
      and d.decision = 'approved'
      and coalesce(nullif(d.extracted->>'period_end', '')::date, d.created_at::date) >= current_date - 90
      and app_private.income_doc_monthly_php(d.metrics, d.extracted->>'currency') > 0
    order by coalesce(nullif(d.extracted->>'period_end', '')::date, d.created_at::date) desc, d.created_at desc
    limit 1
  ),
  me as (
    select u.monthly_income, u.income_type from public.users u where u.id = p_user
  )
  select case
    when (select ceiling_usd from team) is not null
      then jsonb_build_object('ceiling', (select ceiling_usd from team), 'source', 'team')
    when (select php from doc) is not null
      then jsonb_build_object(
        'ceiling', case when (select php from doc) >= 23000 then 140 when (select php from doc) >= 12000 then 60 else 35 end,
        'source', 'income_proof',
        'monthly_php', (select php from doc))
    else jsonb_build_object(
      'ceiling', case when (select income_type from me) = 'none' or (select monthly_income from me) = 'under_200' then 35 else 60 end,
      'source', 'sign_up')
  end;
$function$;
