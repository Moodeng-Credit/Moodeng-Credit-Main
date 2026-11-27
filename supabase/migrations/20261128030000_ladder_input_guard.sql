-- Ladder inputs can't be gamed from the app (second review, 2026-11-27).
--
-- Borrowers can update their own users row. The ladder reads three of its columns:
--   * created_at      → Track A (joined before Oct 2026: old ladder, no low-income rule). A borrower could set
--                        it to September to switch tracks. Now only server-side code can change it.
--   * monthly_income  → 'under_200' = the low-income ladder ($35 top, spins from day 7).
--   * income_type     → 'none' = the low-income ladder too.
--     Answering for the first time, or moving DOWN into the low-income answers, is allowed. Moving back out
--     of them from the app is not (that flip could turn the day-7 rule on and off around a repayment); proof
--     of income or the team lifts them instead. Blocked changes are quietly kept as they were, so the bio
--     form still saves everything else.
-- Also: an income document's period end can't be later than when it was sent (a payslip "for Nov 1–30"
-- uploaded Nov 15 counted until mid-February).

create or replace function app_private.guard_ladder_inputs()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    return new;
  end if;
  new.created_at := old.created_at;
  if old.monthly_income = 'under_200' and new.monthly_income is distinct from 'under_200' then
    new.monthly_income := old.monthly_income;
  end if;
  if old.income_type = 'none' and new.income_type is distinct from 'none' then
    new.income_type := old.income_type;
  end if;
  return new;
end;
$function$;

drop trigger if exists guard_ladder_inputs on public.users;
create trigger guard_ladder_inputs
  before insert or update on public.users
  for each row execute function app_private.guard_ladder_inputs();

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
      least(coalesce(app_private.safe_date(d.extracted->>'period_end'), d.created_at::date), d.created_at::date) as dated,
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
