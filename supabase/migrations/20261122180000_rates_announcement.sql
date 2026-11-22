-- Monthly "rates go down when we all repay" card on the borrower dashboard.
-- Numbers George sets live in telegram_bot_settings.rates_card (JSON):
--   enabled      show the card at all
--   average_pct  headline average for the month, ALL loans incl. OTC outside the app (null = app loans only)
--   goal_pct     on-time share that unlocks the lower rate
--   next_pct     the rate everyone gets next loan if the goal is reached
-- The on-time share and the borrower's own rate are worked out here from real loans.

insert into public.telegram_bot_settings (key, value, description)
values (
  'rates_card',
  '{"enabled": false, "average_pct": 13, "goal_pct": 90, "next_pct": 8}',
  'Dashboard rates card: enabled, average_pct (all loans incl. OTC; null = app only), goal_pct, next_pct'
)
on conflict (key) do nothing;

create or replace function public.rates_announcement()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cfg jsonb;
  month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  due_count int;
  on_time_count int;
  app_avg numeric;
  my_rate numeric;
begin
  select value::jsonb into cfg from telegram_bot_settings where key = 'rates_card';
  if cfg is null or coalesce((cfg->>'enabled')::boolean, false) = false then
    return jsonb_build_object('enabled', false);
  end if;

  -- Loans due so far this month (Bangkok), and how many were fully repaid by their due time.
  select count(*), count(*) filter (where repaid_at is not null and repaid_at <= due_date)
    into due_count, on_time_count
    from loans
   where loan_status = 'Lent' and due_date >= month_start and due_date <= now();

  select avg((total_repayment_amount - loan_amount) / loan_amount) * 100
    into app_avg
    from loans
   where loan_amount > 0 and loan_status = 'Lent' and coalesce(funded_at, created_at) >= month_start;

  -- The caller's rate on their latest loan (requested or lent).
  select (total_repayment_amount - loan_amount) / loan_amount * 100
    into my_rate
    from loans
   where borrower_user_id = auth.uid() and loan_amount > 0
   order by created_at desc
   limit 1;

  return jsonb_build_object(
    'enabled', true,
    'month', to_char(now() at time zone 'Asia/Bangkok', 'YYYY-MM'),
    'average_pct', round(coalesce((cfg->>'average_pct')::numeric, app_avg), 1),
    'goal_pct', coalesce((cfg->>'goal_pct')::numeric, 90),
    'next_pct', (cfg->>'next_pct')::numeric,
    'on_time_pct', case when due_count > 0 then round(on_time_count * 100.0 / due_count) end,
    'my_rate_pct', round(my_rate, 1)
  );
end;
$$;

revoke all on function public.rates_announcement() from public, anon;
grant execute on function public.rates_announcement() to authenticated;
