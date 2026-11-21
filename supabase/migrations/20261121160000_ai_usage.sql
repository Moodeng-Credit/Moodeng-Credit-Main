-- Real AI costs (George 2026-11-21: "log real AI costs"). Every Gemini / DeepSeek call that reports usage
-- writes one row here (_shared/aiUsage.ts, fire and forget). Prices per million tokens are a setting the
-- team can edit (telegram_bot_settings.ai_prices) — DeepSeek and Google change them — and
-- ai_cost_summary() turns tokens into dollars for the Monday report: per feature, and per pre-screening /
-- per proof-of-income send. Service role only; no borrower data in here.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0
);
create index if not exists ai_usage_at_idx on public.ai_usage (at);
alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;

-- USD per million tokens, as of 2026-11-21 (Gemini 3.8 Flash intro rate until Dec 31; DeepSeek peak rates).
insert into public.telegram_bot_settings (key, value)
values ('ai_prices', '{"gemini-3.8-flash":{"in":0.75,"out":3.75},"deepseek-v4-pro":{"in":1.32,"out":3.96},"deepseek-flash":{"in":0.30,"out":1.20},"default":{"in":1.00,"out":4.00}}')
on conflict (key) do nothing;

create or replace function public.ai_cost_summary(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with prices as (
    select coalesce((select value::jsonb from public.telegram_bot_settings where key = 'ai_prices'), '{}'::jsonb) as p
  ),
  rows as (
    select u.feature,
           (u.input_tokens * coalesce((pr.p -> u.model ->> 'in')::numeric, (pr.p -> 'default' ->> 'in')::numeric, 1)
          + u.output_tokens * coalesce((pr.p -> u.model ->> 'out')::numeric, (pr.p -> 'default' ->> 'out')::numeric, 4)) / 1000000 as usd
    from public.ai_usage u, prices pr
    where u.at > now() - make_interval(days => p_days)
  ),
  by_feature as (
    select feature, count(*) as calls, round(sum(usd), 4) as usd from rows group by feature
  )
  select jsonb_build_object(
    'days', p_days,
    'total_usd', coalesce((select round(sum(usd), 4) from rows), 0),
    'calls', (select count(*) from rows),
    'features', coalesce((select jsonb_agg(jsonb_build_object('feature', feature, 'calls', calls, 'usd', usd) order by usd desc) from by_feature), '[]'::jsonb),
    'prescreen_usd', coalesce((select round(sum(usd), 4) from rows where feature like 'prescreen%'), 0),
    'prescreens', (select count(*) from public.pre_screenings where graded_at > now() - make_interval(days => p_days)),
    'income_usd', coalesce((select round(sum(usd), 4) from rows where feature like 'income%' or feature like 'payslip%'), 0),
    'income_docs', (select count(*) from public.income_documents where status = 'done' and created_at > now() - make_interval(days => p_days))
  );
$$;
revoke all on function public.ai_cost_summary(integer) from public, anon, authenticated;
grant execute on function public.ai_cost_summary(integer) to service_role;
