-- Income ceilings (George, 2026-11-27: "ceilings first"). A borrower's limit stops growing at a ceiling set
-- by what we know about their income, so low earners don't climb to loans they can't repay. Steps are
-- unchanged ($10 a level); only the top moves. A limit is never lowered: someone already above their
-- ceiling keeps it and just stops growing.
--
--   1. The team's number for this person (borrower_limit_ceilings), if set.
--   2. Else a team-approved income document (income_documents.decision = 'approved', PHP), best month:
--      ≥ ₱23,000 → $140 (no ceiling) · ≥ ₱12,000 → $60 · less → $35.
--   3. Else the sign-up answer, which can only hold someone lower: no income or under $200/month → $35,
--      anything else → $60. Self-reported income never unlocks more than $60.
--
-- Read by _shared/repaymentFollowUps.ts (the only writer of users.cs) via limit_ceiling_for(), and by the
-- borrower's home card via my_limit_ceiling().

create table if not exists public.borrower_limit_ceilings (
  user_id uuid primary key references public.users(id) on delete cascade,
  ceiling_usd numeric not null check (ceiling_usd >= 15),
  note text,
  set_by uuid,
  set_at timestamptz not null default now()
);
alter table public.borrower_limit_ceilings enable row level security;
revoke all on public.borrower_limit_ceilings from anon, authenticated;

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
    select max(greatest(
      coalesce(nullif(d.metrics->>'monthly_in', '')::numeric, 0),
      coalesce(nullif(d.metrics->>'net_pay', '')::numeric, 0)
    )) as php
    from public.income_documents d
    where d.user_id = p_user and d.decision = 'approved' and coalesce(d.extracted->>'currency', 'PHP') = 'PHP'
  ),
  me as (
    select u.monthly_income, u.income_type from public.users u where u.id = p_user
  )
  select case
    when (select ceiling_usd from team) is not null
      then jsonb_build_object('ceiling', (select ceiling_usd from team), 'source', 'team')
    when coalesce((select php from doc), 0) > 0
      then jsonb_build_object(
        'ceiling', case when (select php from doc) >= 23000 then 140 when (select php from doc) >= 12000 then 60 else 35 end,
        'source', 'income_proof')
    else jsonb_build_object(
      'ceiling', case when (select income_type from me) = 'none' or (select monthly_income from me) = 'under_200' then 35 else 60 end,
      'source', 'sign_up')
  end;
$function$;

-- Server (service role) lookup for any borrower.
create or replace function public.limit_ceiling_for(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select app_private.limit_ceiling(p_user);
$function$;
revoke all on function public.limit_ceiling_for(uuid) from public, anon, authenticated;
grant execute on function public.limit_ceiling_for(uuid) to service_role;

-- The signed-in borrower's own ceiling, for the home card.
create or replace function public.my_limit_ceiling()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select case when auth.uid() is null then null else app_private.limit_ceiling(auth.uid()) end;
$function$;
revoke all on function public.my_limit_ceiling() from public, anon;
grant execute on function public.my_limit_ceiling() to authenticated;
