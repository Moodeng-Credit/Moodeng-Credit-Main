create table if not exists public.admin_integrity_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'success' check (status in ('success', 'warning', 'error')),
  issue_count int not null default 0,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_integrity_runs_created_at_idx
  on public.admin_integrity_runs (created_at desc);

alter table public.admin_integrity_runs enable row level security;

drop policy if exists "admins manage integrity runs" on public.admin_integrity_runs;
create policy "admins manage integrity runs" on public.admin_integrity_runs
  for all to authenticated
  using (app_private.is_moodeng_admin())
  with check (app_private.is_moodeng_admin());

drop trigger if exists audit_admin_integrity_runs on public.admin_integrity_runs;
create trigger audit_admin_integrity_runs
  after insert or update or delete on public.admin_integrity_runs
  for each row execute function app_private.audit_admin_change();

create or replace function app_private.run_admin_integrity_check()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_id uuid;
  summary jsonb;
  issue_count int;
  critical_count int;
  run_status text;
begin
  with checks as (
    select 'active_loan_missing_borrower_profile'::text as code,
           'critical'::text as severity,
           count(*)::int as count
    from public.loans l
    left join public.users u on u.id = l.borrower_user_id
    where l.loan_status = 'Lent'
      and coalesce(l.repayment_status::text, 'Unpaid') <> 'Paid'
      and (l.borrower_user_id is null or u.id is null)

    union all

    select 'overdue_loan_missing_recovery_case',
           'warning',
           count(*)::int
    from public.loans l
    left join public.default_recovery_case_loans rcl
      on rcl.loan_id = l.id
     and rcl.status in ('unresolved', 'in_recovery')
    where l.loan_status = 'Lent'
      and l.repayment_status in ('Unpaid', 'Partial')
      and l.due_date < now()
      and rcl.id is null

    union all

    select 'restriction_account_status_mismatch',
           'critical',
           count(*)::int
    from public.admin_account_restrictions r
    join public.users u on u.id = r.user_id
    where u.account_status::text is distinct from
      case r.status
        when 'banned' then 'banned'
        when 'watchlist' then 'blocked'
        else 'active'
      end

    union all

    select 'open_request_missing_borrower_profile',
           'critical',
           count(*)::int
    from public.loans l
    left join public.users u on u.id = l.borrower_user_id
    where l.loan_status = 'Requested'
      and (l.borrower_user_id is null or u.id is null)

    union all

    select 'flagged_request_still_open',
           'warning',
           count(*)::int
    from public.admin_loan_request_reviews rr
    join public.loans l on l.id = rr.loan_id
    where rr.status in ('deleted', 'duplicate', 'reported')
      and l.loan_status = 'Requested'

    union all

    select 'borrower_over_active_loan_limit',
           'warning',
           count(*)::int
    from (
      select l.borrower_user_id
      from public.loans l
      left join public.admin_users au
        on au.user_id = l.borrower_user_id
       and au.active = true
      where l.loan_status = 'Lent'
        and l.repayment_status in ('Unpaid', 'Partial')
        and au.user_id is null
      group by l.borrower_user_id
      having count(*) > 2
    ) over_limit

    union all

    select 'verified_borrower_missing_wallet',
           'warning',
           count(*)::int
    from public.users u
    where u.user_role = 'borrower'
      and u.is_world_id = 'ACTIVE'
      and nullif(trim(coalesce(u.wallet_address, '')), '') is null
  ),
  nonzero as (
    select *
    from checks
    where count > 0
  ),
  totals as (
    select coalesce(sum(count), 0)::int as issue_count,
           coalesce(sum(count) filter (where severity = 'critical'), 0)::int as critical_count,
           coalesce(sum(count) filter (where severity = 'warning'), 0)::int as warning_count,
           coalesce(jsonb_object_agg(code, count), '{}'::jsonb) as issue_counts
    from nonzero
  )
  select jsonb_build_object(
           'checked_at', now(),
           'issue_count', totals.issue_count,
           'critical_count', totals.critical_count,
           'warning_count', totals.warning_count,
           'issue_counts', totals.issue_counts,
           'rules', jsonb_build_array(
             'active_loan_missing_borrower_profile',
             'overdue_loan_missing_recovery_case',
             'restriction_account_status_mismatch',
             'open_request_missing_borrower_profile',
             'flagged_request_still_open',
             'borrower_over_active_loan_limit',
             'verified_borrower_missing_wallet'
           )
         ),
         totals.issue_count,
         totals.critical_count
    into summary, issue_count, critical_count
  from totals;

  run_status := case
    when critical_count > 0 then 'error'
    when issue_count > 0 then 'warning'
    else 'success'
  end;

  insert into public.admin_integrity_runs (status, issue_count, summary)
  values (run_status, issue_count, summary)
  returning id into run_id;

  if issue_count > 0 then
    insert into public.admin_user_notices (recipient_user_id, audience, notice_type, title, body, metadata)
    select au.user_id,
           'admin',
           'admin_integrity_daily',
           'Daily admin data check',
           issue_count || ' data check item' || case when issue_count = 1 then '' else 's' end || ' need review. Open the admin panel for the latest run.',
           jsonb_build_object('run_id', run_id, 'status', run_status, 'issue_count', issue_count, 'critical_count', critical_count)
    from public.admin_users au
    where au.active = true;
  end if;

  return run_id;
end;
$$;

revoke all on function app_private.run_admin_integrity_check() from public;
grant execute on function app_private.run_admin_integrity_check() to postgres;

create extension if not exists pg_cron;

select cron.unschedule('admin-daily-integrity-check-daily')
where exists (
  select 1
  from cron.job
  where jobname = 'admin-daily-integrity-check-daily'
);

select cron.schedule(
  'admin-daily-integrity-check-daily',
  '30 0 * * *',
  $$select app_private.run_admin_integrity_check();$$
);
