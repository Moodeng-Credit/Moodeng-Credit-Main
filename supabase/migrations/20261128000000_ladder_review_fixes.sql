-- Fixes from the 2026-11-27 review of the credit ladder (George: "fix").
--
-- 1. A badly written date on an income document no longer breaks the income ceiling. The AI copies
--    period_end "as printed" ("15/10/2026", "Oct 1-15"); ::date threw inside limit_ceiling, and the
--    level-up then went through uncapped. app_private.safe_date returns null instead of throwing.
-- 2. The monthly amount uses net pay only for payslips. Bank statements / GCash use the biggest regular
--    deposit, else money in (a bank statement once read ₱1k "net pay" instead of ₱8.2k coming in).
--    Mirrors supabase/functions/_shared/incomeLadder.ts docMonthlyPhp.
-- 3. "Your limit stays" (my_limit_notice) no longer shows a team reset once the limit was raised again
--    (a borrower raised by hand to $25 kept seeing "stays at $25" for weeks).

create or replace function app_private.safe_date(p_text text)
returns date
language plpgsql
immutable
set search_path to ''
as $function$
begin
  if p_text is null or p_text !~ '^\d{4}-\d{2}-\d{2}' then
    return null;
  end if;
  return left(p_text, 10)::date;
exception when others then
  return null;
end;
$function$;

create or replace function app_private.income_doc_monthly_php(p_metrics jsonb, p_currency text, p_doc_type text)
returns numeric
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v_net numeric;
  v_months numeric;
  v_regular numeric;
  v_in numeric;
begin
  if coalesce(upper(p_currency), 'PHP') <> 'PHP' then
    return null;
  end if;
  begin
    v_net := nullif(p_metrics->>'net_pay', '')::numeric;
    v_months := nullif(p_metrics->>'months_covered', '')::numeric;
    v_regular := nullif(p_metrics->'regular_deposits'->0->>'amount', '')::numeric;
    v_in := nullif(p_metrics->>'monthly_in', '')::numeric;
  exception when others then
    return null;
  end;
  if p_doc_type = 'payslip' and coalesce(v_net, 0) > 0 then
    return round(v_net / case when coalesce(v_months, 0) between 0.2 and 3 then v_months else 1 end);
  end if;
  if coalesce(v_regular, 0) > 0 then
    return round(v_regular);
  end if;
  if coalesce(v_in, 0) > 0 then
    return round(v_in);
  end if;
  if coalesce(v_net, 0) > 0 then
    return round(v_net);
  end if;
  return null;
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
  docs as (
    select app_private.income_doc_monthly_php(d.metrics, d.extracted->>'currency', d.doc_type) as php,
      coalesce(app_private.safe_date(d.extracted->>'period_end'), d.created_at::date) as dated,
      d.created_at
    from public.income_documents d
    where d.user_id = p_user and d.decision = 'approved'
  ),
  doc as (
    select php, dated from docs
    where php > 0 and dated >= current_date - 90
    order by dated desc, created_at desc
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
        'monthly_php', (select php from doc),
        'proof_until', ((select dated from doc) + 90))
    else jsonb_build_object(
      'ceiling', case when (select income_type from me) = 'none' or (select monthly_income from me) = 'under_200' then 35 else 60 end,
      'source', 'sign_up',
      'answered', (select monthly_income from me) is not null)
  end;
$function$;

drop function if exists app_private.income_doc_monthly_php(jsonb, text);

create or replace function public.my_limit_notice()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with me as (
    select u.id, coalesce(u.cs, 15) as cs from public.users u where u.id = auth.uid()
  ),
  reset as (
    -- A team reset only explains a limit that is still at the reset amount ($15).
    select max(a.created_at) as at from public.admin_audit_logs a, me
    where a.target_user_id = me.id and a.action = 'credit_limit_reset_fast_repay' and a.created_at > now() - interval '30 days'
      and me.cs <= 15
  ),
  fast as (
    select max(l.repaid_at) as at from public.loans l, me
    where l.borrower_user_id = me.id and l.repayment_status = 'Paid' and l.refunded_at is null
      and l.credit_limit_at_repayment is not null and l.loan_amount >= l.credit_limit_at_repayment
      and l.credit_limit_at_repayment >= me.cs
      -- At their income ceiling the limit can't grow anyway (the home card says why): no "stays" card.
      and me.cs < coalesce((app_private.limit_ceiling(me.id)->>'ceiling')::numeric, 1000)
      and l.funded_at is not null
      and l.repaid_at < case
        when l.funded_at >= timestamptz '2026-11-27 00:00:00+07' then app_private.loan_reward_from_at(l)
        else l.funded_at + interval '48 hours'
      end
      and l.repaid_at > now() - interval '30 days'
  )
  select case when me.id is null then jsonb_build_object('show', false)
    else jsonb_build_object(
      'show', (select at from reset) is not null or (select at from fast) is not null,
      'limit', me.cs,
      'since', greatest((select at from reset), (select at from fast)))
  end
  from (select 1) one left join me on true;
$function$;
