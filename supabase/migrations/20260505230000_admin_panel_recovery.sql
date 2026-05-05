create schema if not exists app_private;

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin', 'support')),
  active boolean not null default true,
  display_name text,
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  unique (user_id)
);

create or replace function app_private.is_moodeng_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.active = true
      and au.role in ('owner', 'admin', 'support')
  );
$$;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id),
  action text not null,
  target_table text,
  target_id uuid,
  target_user_id uuid references public.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.default_recovery_cases (
  id uuid primary key default gen_random_uuid(),
  borrower_user_id uuid not null references public.users(id) on delete cascade,
  case_manager_user_id uuid references public.users(id),
  status text not null default 'needs_review' check (status in ('needs_review', 'approved', 'rejected', 'active', 'resolved', 'closed')),
  recovery_path text check (recovery_path in ('repay_now', 'extension', 'payment_plan', 'bridge_loan', 'manual')),
  borrower_explanation text,
  evidence_summary text,
  borrower_deposit_amount numeric(12,2) default 0,
  borrower_deposit_tx text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.default_recovery_case_loans (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.default_recovery_cases(id) on delete cascade,
  loan_id uuid references public.loans(id) on delete set null,
  borrower_user_id uuid references public.users(id),
  original_lender_user_id uuid references public.users(id),
  amount_due numeric(12,2) not null default 0,
  due_date timestamptz,
  status text not null default 'unresolved' check (status in ('unresolved', 'in_recovery', 'resolved', 'waived')),
  created_at timestamptz not null default now()
);

create table if not exists public.default_recovery_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.default_recovery_cases(id) on delete cascade,
  sender_user_id uuid references public.users(id),
  sender_kind text not null check (sender_kind in ('borrower', 'lender', 'admin', 'system')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.default_recovery_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.default_recovery_cases(id) on delete cascade,
  admin_user_id uuid references public.users(id),
  action_type text not null check (action_type in ('approve_recovery', 'reject_recovery', 'extend_loan', 'create_payment_plan', 'create_bridge_loan', 'manual_resolution', 'mark_resolved', 'keep_blocked')),
  payload jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.default_recovery_payment_installments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.default_recovery_cases(id) on delete cascade,
  loan_id uuid references public.loans(id) on delete set null,
  installment_number int not null,
  amount_due numeric(12,2) not null,
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'paid', 'missed', 'waived')),
  created_at timestamptz not null default now(),
  unique (case_id, installment_number)
);

create table if not exists public.default_recovery_bridge_loans (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.default_recovery_cases(id) on delete cascade,
  original_lender_user_id uuid references public.users(id),
  bridge_lender_user_id uuid references public.users(id),
  borrower_deposit_amount numeric(12,2) not null default 0,
  bridge_amount numeric(12,2) not null default 0,
  bridge_repayment_amount numeric(12,2) not null default 0,
  bridge_due_date date,
  original_lender_payment_tx text,
  bridge_lender_payment_tx text,
  status text not null default 'draft' check (status in ('draft', 'offered', 'funded', 'repaid', 'failed', 'cancelled')),
  evidence_summary text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_account_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'watchlist' check (status in ('active', 'watchlist', 'banned')),
  reason text not null check (reason in ('spam', 'default', 'duplicate', 'abuse', 'manual')),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  evidence_summary text,
  admin_note text,
  restricted_at timestamptz,
  unrestricted_at timestamptz,
  created_by uuid references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.admin_loan_request_reviews (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid references public.loans(id) on delete set null,
  borrower_user_id uuid references public.users(id),
  status text not null default 'needs_review' check (status in ('needs_review', 'reported', 'duplicate', 'kept', 'deleted')),
  reason text check (reason in ('spam', 'duplicate', 'unsafe', 'bad_data', 'manual')),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  evidence_summary text,
  admin_note text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists admin_loan_request_reviews_loan_id_key
  on public.admin_loan_request_reviews (loan_id)
  where loan_id is not null;

create table if not exists public.admin_risk_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  score int not null default 0 check (score between 0 and 100),
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  status text not null default 'active' check (status in ('active', 'watchlist', 'blocked')),
  algorithm_version text not null default 'manual_scaffold_v1',
  algorithm_note text,
  override_score int check (override_score between 0 and 100),
  override_reason text,
  override_by uuid references public.users(id),
  override_at timestamptz,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.admin_risk_factors (
  id uuid primary key default gen_random_uuid(),
  risk_profile_id uuid not null references public.admin_risk_profiles(id) on delete cascade,
  factor_type text not null check (factor_type in ('repayment', 'wallet', 'behavior', 'identity', 'manual')),
  label text not null,
  weight numeric(8,2) not null default 0,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_user_notices (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  audience text not null check (audience in ('borrower', 'lender', 'candidate_lender', 'admin')),
  notice_type text not null,
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists admin_user_notices_recipient_unread_idx
  on public.admin_user_notices (recipient_user_id, created_at desc)
  where read_at is null;

create unique index if not exists default_recovery_bridge_loans_case_id_key
  on public.default_recovery_bridge_loans (case_id);

alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.default_recovery_cases enable row level security;
alter table public.default_recovery_case_loans enable row level security;
alter table public.default_recovery_messages enable row level security;
alter table public.default_recovery_actions enable row level security;
alter table public.default_recovery_payment_installments enable row level security;
alter table public.default_recovery_bridge_loans enable row level security;
alter table public.admin_account_restrictions enable row level security;
alter table public.admin_loan_request_reviews enable row level security;
alter table public.admin_risk_profiles enable row level security;
alter table public.admin_risk_factors enable row level security;
alter table public.admin_user_notices enable row level security;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed_row jsonb;
  changed_id uuid;
  changed_user_id uuid;
begin
  if tg_op = 'DELETE' then
    changed_row = to_jsonb(old);
    changed_id = old.id;
  else
    changed_row = to_jsonb(new);
    changed_id = new.id;
  end if;

  changed_user_id = nullif(coalesce(changed_row ->> 'user_id', changed_row ->> 'borrower_user_id', changed_row ->> 'recipient_user_id', ''), '')::uuid;

  insert into public.admin_audit_logs (actor_user_id, action, target_table, target_id, target_user_id, metadata)
  values (auth.uid(), lower(tg_op), tg_table_name, changed_id, changed_user_id, jsonb_build_object('row', changed_row));

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop policy if exists "admins can read admin users" on public.admin_users;
create policy "admins can read admin users" on public.admin_users for select to authenticated using (app_private.is_moodeng_admin());

drop policy if exists "admins manage audit logs" on public.admin_audit_logs;
create policy "admins manage audit logs" on public.admin_audit_logs for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage recovery cases" on public.default_recovery_cases;
create policy "admins manage recovery cases" on public.default_recovery_cases for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage recovery loans" on public.default_recovery_case_loans;
create policy "admins manage recovery loans" on public.default_recovery_case_loans for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage recovery messages" on public.default_recovery_messages;
create policy "admins manage recovery messages" on public.default_recovery_messages for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage recovery actions" on public.default_recovery_actions;
create policy "admins manage recovery actions" on public.default_recovery_actions for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage recovery installments" on public.default_recovery_payment_installments;
create policy "admins manage recovery installments" on public.default_recovery_payment_installments for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage bridge loans" on public.default_recovery_bridge_loans;
create policy "admins manage bridge loans" on public.default_recovery_bridge_loans for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage account restrictions" on public.admin_account_restrictions;
create policy "admins manage account restrictions" on public.admin_account_restrictions for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "users can read own active restrictions" on public.admin_account_restrictions;
create policy "users can read own active restrictions" on public.admin_account_restrictions for select to authenticated using (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "admins manage loan request reviews" on public.admin_loan_request_reviews;
create policy "admins manage loan request reviews" on public.admin_loan_request_reviews for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage risk profiles" on public.admin_risk_profiles;
create policy "admins manage risk profiles" on public.admin_risk_profiles for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage risk factors" on public.admin_risk_factors;
create policy "admins manage risk factors" on public.admin_risk_factors for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "admins manage user notices" on public.admin_user_notices;
create policy "admins manage user notices" on public.admin_user_notices for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

drop policy if exists "users can read own notices" on public.admin_user_notices;
create policy "users can read own notices" on public.admin_user_notices for select to authenticated using (auth.uid() is not null and recipient_user_id = auth.uid());

drop policy if exists "users can mark own notices read" on public.admin_user_notices;
create policy "users can mark own notices read" on public.admin_user_notices for update to authenticated using (auth.uid() is not null and recipient_user_id = auth.uid()) with check (auth.uid() is not null and recipient_user_id = auth.uid());

drop policy if exists "admins can read users for admin panel" on public.users;
create policy "admins can read users for admin panel" on public.users for select to authenticated using (app_private.is_moodeng_admin());

drop policy if exists "admins can read loans for admin panel" on public.loans;
create policy "admins can read loans for admin panel" on public.loans for select to authenticated using (app_private.is_moodeng_admin());

drop trigger if exists set_default_recovery_cases_updated_at on public.default_recovery_cases;
create trigger set_default_recovery_cases_updated_at before update on public.default_recovery_cases for each row execute function app_private.set_updated_at();

drop trigger if exists set_default_recovery_bridge_loans_updated_at on public.default_recovery_bridge_loans;
create trigger set_default_recovery_bridge_loans_updated_at before update on public.default_recovery_bridge_loans for each row execute function app_private.set_updated_at();

drop trigger if exists set_admin_account_restrictions_updated_at on public.admin_account_restrictions;
create trigger set_admin_account_restrictions_updated_at before update on public.admin_account_restrictions for each row execute function app_private.set_updated_at();

drop trigger if exists set_admin_loan_request_reviews_updated_at on public.admin_loan_request_reviews;
create trigger set_admin_loan_request_reviews_updated_at before update on public.admin_loan_request_reviews for each row execute function app_private.set_updated_at();

drop trigger if exists set_admin_risk_profiles_updated_at on public.admin_risk_profiles;
create trigger set_admin_risk_profiles_updated_at before update on public.admin_risk_profiles for each row execute function app_private.set_updated_at();

drop trigger if exists audit_admin_users on public.admin_users;
create trigger audit_admin_users after insert or update or delete on public.admin_users for each row execute function app_private.audit_admin_change();

drop trigger if exists audit_default_recovery_cases on public.default_recovery_cases;
create trigger audit_default_recovery_cases after insert or update or delete on public.default_recovery_cases for each row execute function app_private.audit_admin_change();

drop trigger if exists audit_admin_account_restrictions on public.admin_account_restrictions;
create trigger audit_admin_account_restrictions after insert or update or delete on public.admin_account_restrictions for each row execute function app_private.audit_admin_change();

drop trigger if exists audit_admin_user_notices on public.admin_user_notices;
create trigger audit_admin_user_notices after insert or update or delete on public.admin_user_notices for each row execute function app_private.audit_admin_change();

insert into public.admin_users (user_id, role, active, display_name)
select id, 'owner', true, username
from public.users
where lower(username) in ('cookiemonster1337', 'emma_moodeng')
on conflict (user_id) do update
set active = true,
    role = excluded.role,
    display_name = excluded.display_name;
