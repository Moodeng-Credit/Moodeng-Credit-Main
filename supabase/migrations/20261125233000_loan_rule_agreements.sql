-- "Keep your loan 2+ days" card (2026-11-25): record that a borrower tapped "I understand" before
-- their request went out, with the terms they saw. Written only through agree_loan_rules().
create table if not exists public.loan_rule_agreements (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  agreed_at timestamptz not null default now(),
  loan_amount numeric,
  total_repayment numeric,
  due_date date,
  level_up_to numeric
);
create index if not exists loan_rule_agreements_user_idx on public.loan_rule_agreements (user_id, agreed_at desc);
alter table public.loan_rule_agreements enable row level security;
create policy "users read own loan rule agreements" on public.loan_rule_agreements
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.agree_loan_rules(
  p_loan_amount numeric,
  p_total numeric,
  p_due date,
  p_level_up_to numeric
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.loan_rule_agreements (user_id, loan_amount, total_repayment, due_date, level_up_to)
  values (auth.uid(), p_loan_amount, p_total, p_due, p_level_up_to);
end;
$$;
revoke all on function public.agree_loan_rules(numeric, numeric, date, numeric) from public, anon;
grant execute on function public.agree_loan_rules(numeric, numeric, date, numeric) to authenticated;
