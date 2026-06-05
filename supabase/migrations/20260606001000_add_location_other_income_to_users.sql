alter table public.users
  add column if not exists location text,
  add column if not exists other_income text;
