alter table public.users
  add column if not exists income_type text,
  add column if not exists payday_type text,
  add column if not exists payday_start smallint,
  add column if not exists payday_end smallint,
  add column if not exists gap_reasons text[];
