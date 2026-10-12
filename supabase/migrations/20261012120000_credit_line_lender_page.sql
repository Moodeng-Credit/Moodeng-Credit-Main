-- Lender page (moodeng.app/creditline): the facility lender (BitRepo) opens a password-protected page with
-- the live monthly report and an Excel download, instead of waiting for a spreadsheet each month.
--
--   credit_facility_access          — one password per facility, stored as a bcrypt hash (pgcrypto).
--   credit_facility_access_attempts — every password attempt, so repeated wrong guesses lock the page.
--   credit_line_lender_report(p)    — anon-callable: checks the password, then returns that facility's
--                                     terms, loans (with username, KYC status and wallet — no full names)
--                                     and ledger as one JSON document. Nothing else is reachable.
--
-- Change the password:  update public.credit_facility_access
--                         set password_hash = extensions.crypt('<new>', extensions.gen_salt('bf')), updated_at = now()
--                       where facility_id = (select id from public.credit_facilities where name = 'BitRepo pilot');

create table if not exists public.credit_facility_access (
  facility_id uuid primary key references public.credit_facilities(id) on delete cascade,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_facility_access_attempts (
  id bigserial primary key,
  attempted_at timestamptz not null default now(),
  ok boolean not null
);
create index if not exists credit_facility_access_attempts_at_idx on public.credit_facility_access_attempts (attempted_at desc);

-- Never readable from the browser: only the function below touches these.
alter table public.credit_facility_access enable row level security;
alter table public.credit_facility_access_attempts enable row level security;
revoke all on public.credit_facility_access, public.credit_facility_access_attempts from anon, authenticated;

create or replace function public.credit_line_lender_report(p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_facility_id uuid;
  v_recent_failures int;
  v_result jsonb;
begin
  -- More than 10 wrong passwords in 15 minutes (from anyone) locks the page for everyone until they age out.
  select count(*) into v_recent_failures
  from public.credit_facility_access_attempts
  where not ok and attempted_at > now() - interval '15 minutes';
  if v_recent_failures >= 10 then
    return jsonb_build_object('error', 'locked');
  end if;

  select a.facility_id into v_facility_id
  from public.credit_facility_access a
  where p_password is not null and length(p_password) between 1 and 200
    and a.password_hash = extensions.crypt(p_password, a.password_hash)
  limit 1;

  insert into public.credit_facility_access_attempts (ok) values (v_facility_id is not null);
  if v_facility_id is null then
    return jsonb_build_object('error', 'wrong_password');
  end if;

  select jsonb_build_object(
    'facility', (
      select to_jsonb(f) - 'notes' - 'created_at'
      from public.credit_facilities f where f.id = v_facility_id
    ),
    'loans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'tracking_id', l.tracking_id,
        'borrower_user_id', l.borrower_user_id,
        'funded_at', l.funded_at,
        'due_date', l.due_date,
        'loan_amount', l.loan_amount,
        'total_repayment_amount', l.total_repayment_amount,
        'repaid_amount', l.repaid_amount,
        'repaid_at', l.repaid_at,
        'repayment_status', l.repayment_status,
        'hash', to_jsonb(l.hash),
        'reason', l.reason,
        'rationale', c.rationale,
        'borrower_wallet', l.borrower_wallet,
        'borrower', jsonb_build_object(
          'username', u.username,
          'kyc_passed', (u.is_didit = 'ACTIVE' or u.is_world_id = 'ACTIVE'),
          'kyc_provider', case when u.is_didit = 'ACTIVE' then 'Didit' when u.is_world_id = 'ACTIVE' then 'World ID' end,
          'kyc_date', u.didit_submitted_at,
          'liveness', (u.liveness_status = 'APPROVED'),
          'facebook_verified', (u.messenger_verified_at is not null),
          'video_call_attended', (u.video_call_outcome = 'attended')
        )
      ) order by l.funded_at)
      from public.credit_facility_loans c
      join public.loans l on l.id = c.loan_id
      left join public.users u on u.id = l.borrower_user_id
      where c.facility_id = v_facility_id
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(to_jsonb(g) - 'facility_id' - 'created_at' order by g.occurred_at)
      from public.credit_facility_ledger g where g.facility_id = v_facility_id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.credit_line_lender_report(text) from public;
grant execute on function public.credit_line_lender_report(text) to anon, authenticated;

-- The password itself is set directly on the database (never committed); see the header for the statement.
