create table if not exists public.loan_request_delete_events (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null,
  borrower_user_id uuid not null references public.users(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

create index if not exists loan_request_delete_events_borrower_deleted_at_idx
  on public.loan_request_delete_events (borrower_user_id, deleted_at desc);

alter table public.loan_request_delete_events enable row level security;

drop policy if exists "Borrowers can read own loan request delete events" on public.loan_request_delete_events;
create policy "Borrowers can read own loan request delete events" on public.loan_request_delete_events
  for select to authenticated
  using (borrower_user_id = auth.uid());

create or replace function public.get_loan_request_repost_status()
returns table (
  delete_count_24h integer,
  cooldown_until timestamptz,
  can_create boolean
)
language sql
security definer
set search_path = public
as $$
  with recent_deletes as (
    select deleted_at
    from public.loan_request_delete_events
    where borrower_user_id = auth.uid()
      and deleted_at > now() - interval '24 hours'
  ),
  delete_stats as (
    select count(*)::integer as delete_count_24h, max(deleted_at) as latest_deleted_at
    from recent_deletes
  )
  select
    delete_count_24h,
    case
      when delete_count_24h >= 2 and latest_deleted_at > now() - interval '30 minutes'
        then latest_deleted_at + interval '30 minutes'
      else null
    end as cooldown_until,
    not (delete_count_24h >= 2 and latest_deleted_at > now() - interval '30 minutes') as can_create
  from delete_stats;
$$;

create or replace function public.can_create_loan_request(p_borrower_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select p_borrower_user_id = auth.uid()
    and coalesce((select can_create from public.get_loan_request_repost_status() limit 1), false);
$$;

create or replace function public.record_loan_request_delete_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.loan_status = 'Requested' and old.borrower_user_id is not null then
    insert into public.loan_request_delete_events (loan_id, borrower_user_id, deleted_at)
    values (old.id, old.borrower_user_id, now());
  end if;

  return old;
end;
$$;

drop trigger if exists trg_record_loan_request_delete_event on public.loans;
create trigger trg_record_loan_request_delete_event
  after delete on public.loans
  for each row
  execute function public.record_loan_request_delete_event();

drop policy if exists "Authenticated users can create loans" on public.loans;
create policy "Authenticated users can create loans" on public.loans
  for insert to authenticated
  with check (
    borrower_user_id = auth.uid()
    and public.can_create_loan_request(borrower_user_id)
  );

grant execute on function public.get_loan_request_repost_status() to authenticated;
grant execute on function public.can_create_loan_request(uuid) to authenticated;
grant select on public.loan_request_delete_events to authenticated;
