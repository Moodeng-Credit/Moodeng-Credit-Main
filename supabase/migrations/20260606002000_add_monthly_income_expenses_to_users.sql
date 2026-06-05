alter table public.users
  add column if not exists monthly_income text,
  add column if not exists monthly_expenses text;
