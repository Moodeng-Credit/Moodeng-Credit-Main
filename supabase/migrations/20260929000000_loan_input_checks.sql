-- Every loan-form input the AI checker judges (reason, profession, income situation).
--
-- Written only by the check-loan-input edge function (service role). Lets the team see what
-- borrowers typed, what was turned away and why, and tune loan-reason-guide.md from real cases.
-- Borrowers can't read it; admins can.

create table if not exists public.loan_input_checks (
   id bigint generated always as identity primary key,
   user_id uuid references public.users(id) on delete set null,
   kind text not null,
   text text not null,
   ok boolean not null,
   -- good | tip | vague | placeholder | not_english | not_allowed (reason checks only)
   category text,
   hint text not null default '',
   suggestion text not null default '',
   model text,
   created_at timestamptz not null default now()
);

create index if not exists loan_input_checks_created_at_idx on public.loan_input_checks (created_at desc);
create index if not exists loan_input_checks_user_id_idx on public.loan_input_checks (user_id, created_at desc);

alter table public.loan_input_checks enable row level security;

drop policy if exists "admins read loan input checks" on public.loan_input_checks;
create policy "admins read loan input checks" on public.loan_input_checks
   for select to authenticated using (app_private.is_moodeng_admin());
