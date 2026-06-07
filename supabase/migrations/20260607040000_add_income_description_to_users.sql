-- Free-text "describe your situation" for the borrower bio's "Something else"
-- work option. Mirrors the existing `profession` column.
alter table public.users
  add column if not exists income_description text;
