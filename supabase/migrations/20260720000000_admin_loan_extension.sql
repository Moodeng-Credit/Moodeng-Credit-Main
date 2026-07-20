-- Admin loan-extension tooling.
--
-- The team needs to push a loan's due date out (grace period, payment plan, hardship)
-- straight from the admin panel and have both parties notified. loans.due_date is locked
-- to server-side writes by enforce_loan_money_columns_service_role_only() (a SECURITY INVOKER
-- trigger that blocks the 'authenticated'/'anon' roles), so the admin browser client cannot
-- UPDATE it directly. This SECURITY DEFINER RPC runs as the function owner (postgres), whose
-- current_user is NOT in ('authenticated','anon'), so the money-columns trigger lets the write
-- through — while the is_moodeng_admin() gate keeps it admin-only.

-- ---------------------------------------------------------------------------
-- Audit trail of every extension (who, when, old/new due date, why).
-- ---------------------------------------------------------------------------
create table if not exists public.loan_extensions (
  id                 uuid primary key default gen_random_uuid(),
  loan_id            uuid not null references public.loans(id) on delete cascade,
  extended_by        uuid references public.users(id),
  previous_due_date  timestamptz not null,
  new_due_date       timestamptz not null,
  days_extended      integer not null,
  reason             text,
  created_at         timestamptz not null default now()
);

create index if not exists loan_extensions_loan_id_idx
  on public.loan_extensions (loan_id, created_at desc);

alter table public.loan_extensions enable row level security;

-- Admins manage; borrowers/lenders can read the extensions on their own loans.
drop policy if exists "admins manage loan extensions" on public.loan_extensions;
create policy "admins manage loan extensions" on public.loan_extensions
  for all to authenticated
  using (app_private.is_moodeng_admin())
  with check (app_private.is_moodeng_admin());

drop policy if exists "parties read own loan extensions" on public.loan_extensions;
create policy "parties read own loan extensions" on public.loan_extensions
  for select to authenticated
  using (
    auth.uid() is not null
    and exists (
      select 1 from public.loans l
      where l.id = loan_extensions.loan_id
        and (l.borrower_user_id = auth.uid() or l.lender_user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- admin_extend_loan: move an active loan's due date forward and record it.
-- Returns loan/party details so the caller can notify both sides.
-- ---------------------------------------------------------------------------
create or replace function public.admin_extend_loan(
  p_loan_id      uuid,
  p_new_due_date timestamptz,
  p_reason       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_loan       public.loans%rowtype;
  v_actor      uuid := auth.uid();
  v_days       integer;
  v_extension  public.loan_extensions%rowtype;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized';
  end if;

  if p_new_due_date is null then
    raise exception 'a new due date is required';
  end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then
    raise exception 'loan not found';
  end if;

  if v_loan.loan_status is distinct from 'Lent' then
    raise exception 'only funded (Lent) loans can be extended';
  end if;

  if v_loan.repayment_status = 'Paid' then
    raise exception 'this loan is already fully repaid';
  end if;

  if v_loan.due_date is null then
    raise exception 'this loan has no due date to extend';
  end if;

  if p_new_due_date <= v_loan.due_date then
    raise exception 'the new due date must be later than the current due date';
  end if;

  v_days := ceil(extract(epoch from (p_new_due_date - v_loan.due_date)) / 86400.0)::integer;

  insert into public.loan_extensions (loan_id, extended_by, previous_due_date, new_due_date, days_extended, reason)
  values (p_loan_id, v_actor, v_loan.due_date, p_new_due_date, v_days, nullif(btrim(p_reason), ''))
  returning * into v_extension;

  update public.loans
     set due_date = p_new_due_date
   where id = p_loan_id;

  return jsonb_build_object(
    'extension_id',      v_extension.id,
    'loan_id',           v_loan.id,
    'tracking_id',       v_loan.tracking_id,
    'borrower_user_id',  v_loan.borrower_user_id,
    'lender_user_id',    v_loan.lender_user_id,
    'previous_due_date', v_loan.due_date,
    'new_due_date',      p_new_due_date,
    'days_extended',     v_days
  );
end;
$$;

revoke all on function public.admin_extend_loan(uuid, timestamptz, text) from public;
grant execute on function public.admin_extend_loan(uuid, timestamptz, text) to authenticated, service_role, postgres;
