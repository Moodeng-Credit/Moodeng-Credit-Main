create table if not exists public.trust_point_events (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  delta bigint not null,
  source_type text not null,
  source_id uuid not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists trust_point_events_unique_event
  on public.trust_point_events (user_id, source_type, source_id, event_type);

create index if not exists trust_point_events_user_created_idx
  on public.trust_point_events (user_id, created_at desc);

create table if not exists public.user_trust_points (
  user_id uuid primary key references public.users(id) on delete cascade,
  points_total bigint not null default 0,
  updated_at timestamptz not null default now(),
  last_event_id bigint references public.trust_point_events(id) on delete set null
);

alter table public.user_milestone_completions
  add column if not exists trust_point_event_id bigint references public.trust_point_events(id) on delete set null;

create index if not exists user_milestone_completions_trust_point_event_idx
  on public.user_milestone_completions (trust_point_event_id);

alter table public.trust_point_events enable row level security;
alter table public.user_trust_points enable row level security;

drop policy if exists "Users can read their own trust point events" on public.trust_point_events;
create policy "Users can read their own trust point events"
  on public.trust_point_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can read trust point events for admin panel" on public.trust_point_events;
create policy "Admins can read trust point events for admin panel"
  on public.trust_point_events
  for select
  to authenticated
  using (app_private.is_moodeng_admin());

drop policy if exists "Users can read their own trust points total" on public.user_trust_points;
create policy "Users can read their own trust points total"
  on public.user_trust_points
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins can read trust points totals for admin panel" on public.user_trust_points;
create policy "Admins can read trust points totals for admin panel"
  on public.user_trust_points
  for select
  to authenticated
  using (app_private.is_moodeng_admin());

grant select on public.trust_point_events to authenticated;
grant select on public.user_trust_points to authenticated;

create or replace function private.award_trust_points(
  user_id_input uuid,
  source_type_input text,
  source_id_input uuid,
  event_type_input text,
  delta_input bigint,
  metadata_input jsonb default '{}'::jsonb
)
returns table(applied boolean, event_id bigint, points_total bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_event_id bigint;
  existing_event_id bigint;
  updated_total bigint;
begin
  insert into public.trust_point_events (user_id, event_type, delta, source_type, source_id, metadata)
  values (user_id_input, event_type_input, delta_input, source_type_input, source_id_input, coalesce(metadata_input, '{}'::jsonb))
  on conflict (user_id, source_type, source_id, event_type) do nothing
  returning id into inserted_event_id;

  if inserted_event_id is not null then
    insert into public.user_trust_points (user_id, points_total, updated_at, last_event_id)
    values (user_id_input, delta_input, now(), inserted_event_id)
    on conflict (user_id) do update
      set points_total = public.user_trust_points.points_total + excluded.points_total,
          updated_at = now(),
          last_event_id = excluded.last_event_id;
  else
    select tpe.id
    into existing_event_id
    from public.trust_point_events as tpe
    where tpe.user_id = user_id_input
      and tpe.source_type = source_type_input
      and tpe.source_id = source_id_input
      and tpe.event_type = event_type_input;

    insert into public.user_trust_points (user_id, points_total, updated_at)
    values (user_id_input, 0, now())
    on conflict (user_id) do nothing;
  end if;

  select utp.points_total
  into updated_total
  from public.user_trust_points as utp
  where utp.user_id = user_id_input;

  return query
    select inserted_event_id is not null,
      coalesce(inserted_event_id, existing_event_id),
      coalesce(updated_total, 0);
end;
$$;

create or replace function private.is_trust_milestone_complete(
  user_id_input uuid,
  milestone_id_input text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  on_time_paid_count integer := 0;
  funded_count integer := 0;
  unique_lender_count integer := 0;
  total_repaid numeric := 0;
  has_unresolved_default boolean := false;
  credit_limit integer := 0;
  is_verified boolean := false;
begin
  select
    coalesce(u.cs, 0),
    coalesce(u.is_world_id::text = 'ACTIVE', false)
  into credit_limit, is_verified
  from public.users as u
  where u.id = user_id_input;

  select count(*)::integer
  into funded_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.loan_status = 'Lent';

  select count(*)::integer
  into on_time_paid_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.repayment_status = 'Paid'
    and coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
    and l.updated_at <= l.due_date;

  select count(distinct l.lender_user_id)::integer
  into unique_lender_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.loan_status = 'Lent'
    and l.lender_user_id is not null;

  select coalesce(sum(coalesce(l.repaid_amount, 0)), 0)
  into total_repaid
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.repayment_status = 'Paid';

  select exists (
    select 1
    from public.loans as l
    where l.borrower_user_id = user_id_input
      and l.loan_status = 'Lent'
      and coalesce(l.repayment_status::text, 'Unpaid') <> 'Paid'
      and l.due_date < now()
  )
  into has_unresolved_default;

  if milestone_id_input = 'verify-identity' then
    return is_verified;
  elsif milestone_id_input = 'first-loan-request' then
    return exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
    );
  elsif milestone_id_input = 'first-funded-loan' then
    return funded_count >= 1;
  elsif milestone_id_input = 'first-on-time-repayment' then
    return on_time_paid_count >= 1;
  elsif milestone_id_input = 'two-on-time-streak' then
    return on_time_paid_count >= 2;
  elsif milestone_id_input = 'full-limit-credit-builder' then
    return exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.repayment_status = 'Paid'
        and coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
        and l.updated_at <= l.due_date
        and l.loan_amount in (15, 20, 40, 60, 80, 100, 120, 140)
    );
  elsif milestone_id_input = 'two-unique-lenders' then
    return unique_lender_count >= 2;
  elsif milestone_id_input = 'repay-100-total' then
    return total_repaid >= 100;
  elsif milestone_id_input = 'reach-level-three' then
    return is_verified and credit_limit >= 40;
  elsif milestone_id_input = 'trusted-borrower-candidate' then
    return on_time_paid_count >= 5 and unique_lender_count >= 3 and not has_unresolved_default;
  end if;

  return false;
end;
$$;

create or replace function private.sync_user_rewards(user_id_input uuid)
returns table(reward_id text, unlocked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  current_points bigint := 0;
begin
  if actor_user_id is not null and actor_user_id <> user_id_input then
    raise exception 'Users can only sync their own rewards' using errcode = '42501';
  end if;

  select coalesce(utp.points_total, 0)
  into current_points
  from public.user_trust_points as utp
  where utp.user_id = user_id_input;

  insert into public.user_rewards (user_id, reward_id, source_type)
  select user_id_input, rd.id, 'trust_points'
  from public.reward_definitions as rd
  where rd.is_active = true
    and rd.required_points_total <= coalesce(current_points, 0)
  on conflict on constraint user_rewards_user_id_reward_id_key do nothing;

  return query
  select ur.reward_id, ur.unlocked_at
  from public.user_rewards as ur
  where ur.user_id = user_id_input
  order by ur.unlocked_at desc;
end;
$$;

create or replace function private.record_milestone_completion(
  user_id_input uuid,
  milestone_id_input text,
  metadata_input jsonb default '{}'::jsonb
)
returns table(applied boolean, milestone_id text, points_total bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  milestone_record public.milestone_definitions%rowtype;
  inserted_completion_id uuid;
  awarded_event_id bigint;
  awarded_points_total bigint;
  current_total bigint := 0;
begin
  if actor_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if actor_user_id <> user_id_input then
    raise exception 'Users can only complete their own milestones' using errcode = '42501';
  end if;

  select *
  into milestone_record
  from public.milestone_definitions
  where id = milestone_id_input
    and is_active = true;

  if not found then
    raise exception 'Milestone not found' using errcode = 'P0002';
  end if;

  if not private.is_trust_milestone_complete(user_id_input, milestone_record.id) then
    raise exception 'Milestone criteria not met' using errcode = '23514';
  end if;

  insert into public.user_milestone_completions (
    user_id,
    milestone_id,
    source_type,
    source_id,
    metadata
  )
  values (
    user_id_input,
    milestone_record.id,
    'milestone',
    milestone_record.point_source_id,
    coalesce(metadata_input, '{}'::jsonb)
  )
  on conflict on constraint user_milestone_completions_user_id_milestone_id_key do nothing
  returning id into inserted_completion_id;

  if inserted_completion_id is not null then
    select award.event_id, award.points_total
    into awarded_event_id, awarded_points_total
    from private.award_trust_points(
      user_id_input,
      'reputation_milestone',
      milestone_record.point_source_id,
      'completed',
      milestone_record.points_awarded,
      coalesce(metadata_input, '{}'::jsonb) || jsonb_build_object(
        'milestone_id', milestone_record.id,
        'title', milestone_record.title,
        'outcome', milestone_record.outcome,
        'benefit', milestone_record.benefit
      )
    ) as award;

    update public.user_milestone_completions
    set trust_point_event_id = awarded_event_id
    where id = inserted_completion_id;
  end if;

  perform private.sync_user_rewards(user_id_input);

  select coalesce(utp.points_total, 0)
  into current_total
  from public.user_trust_points as utp
  where utp.user_id = user_id_input;

  return query
  select
    inserted_completion_id is not null,
    milestone_record.id,
    coalesce(awarded_points_total, current_total, 0);
end;
$$;

create or replace function private.sync_completed_trust_milestones(user_id_input uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  milestone_record public.milestone_definitions%rowtype;
  inserted_completion_id uuid;
  awarded_event_id bigint;
begin
  if user_id_input is null then
    return;
  end if;

  for milestone_record in
    select *
    from public.milestone_definitions
    where is_active = true
    order by points_awarded asc, id asc
  loop
    if private.is_trust_milestone_complete(user_id_input, milestone_record.id) then
      inserted_completion_id := null;
      awarded_event_id := null;

      insert into public.user_milestone_completions (
        user_id,
        milestone_id,
        source_type,
        source_id,
        metadata
      )
      values (
        user_id_input,
        milestone_record.id,
        'milestone',
        milestone_record.point_source_id,
        jsonb_build_object(
          'milestone_id', milestone_record.id,
          'title', milestone_record.title,
          'synced_by', 'database'
        )
      )
      on conflict on constraint user_milestone_completions_user_id_milestone_id_key do nothing
      returning id into inserted_completion_id;

      if inserted_completion_id is not null then
        select award.event_id
        into awarded_event_id
        from private.award_trust_points(
          user_id_input,
          'reputation_milestone',
          milestone_record.point_source_id,
          'completed',
          milestone_record.points_awarded,
          jsonb_build_object(
            'milestone_id', milestone_record.id,
            'title', milestone_record.title,
            'outcome', milestone_record.outcome,
            'benefit', milestone_record.benefit,
            'synced_by', 'database'
          )
        ) as award;

        update public.user_milestone_completions
        set trust_point_event_id = awarded_event_id
        where id = inserted_completion_id;
      end if;
    end if;
  end loop;

  perform private.sync_user_rewards(user_id_input);
end;
$$;

create or replace function private.sync_completed_trust_milestones_from_loan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_completed_trust_milestones(new.borrower_user_id);
  return new;
end;
$$;

create or replace function private.sync_completed_trust_milestones_from_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_completed_trust_milestones(new.id);
  return new;
end;
$$;

drop trigger if exists sync_completed_trust_milestones_on_loans on public.loans;
create trigger sync_completed_trust_milestones_on_loans
  after insert or update of borrower_user_id, lender_user_id, loan_amount, repaid_amount, total_repayment_amount, due_date, loan_status, repayment_status, updated_at
  on public.loans
  for each row
  execute function private.sync_completed_trust_milestones_from_loan();

drop trigger if exists sync_completed_trust_milestones_on_users on public.users;
create trigger sync_completed_trust_milestones_on_users
  after insert or update of is_world_id, cs
  on public.users
  for each row
  execute function private.sync_completed_trust_milestones_from_user();

insert into public.trust_point_events (user_id, event_type, delta, source_type, source_id, created_at, metadata)
select pe.user_id, pe.event_type, pe.delta, pe.source_type, pe.source_id, pe.created_at, pe.metadata
from public.point_events as pe
where pe.source_type = 'reputation_milestone'
on conflict (user_id, source_type, source_id, event_type) do nothing;

update public.user_milestone_completions as completion
set trust_point_event_id = trust_event.id
from public.milestone_definitions as definition,
     public.trust_point_events as trust_event
where completion.milestone_id = definition.id
  and completion.user_id = trust_event.user_id
  and definition.point_source_id = trust_event.source_id
  and trust_event.source_type = 'reputation_milestone'
  and trust_event.event_type = 'completed';

insert into public.user_trust_points (user_id, points_total, updated_at, last_event_id)
select tpe.user_id, sum(tpe.delta)::bigint, now(), max(tpe.id)
from public.trust_point_events as tpe
group by tpe.user_id
on conflict (user_id) do update
  set points_total = excluded.points_total,
      updated_at = now(),
      last_event_id = excluded.last_event_id;

delete from public.point_events
where source_type = 'reputation_milestone';

insert into public.user_points (user_id, points_total, updated_at, last_event_id)
select pe.user_id, sum(pe.delta)::bigint, now(), max(pe.id)
from public.point_events as pe
group by pe.user_id
on conflict (user_id) do update
  set points_total = excluded.points_total,
      updated_at = now(),
      last_event_id = excluded.last_event_id;

update public.user_points as up
set points_total = 0,
    updated_at = now(),
    last_event_id = null
where not exists (
  select 1
  from public.point_events as pe
  where pe.user_id = up.user_id
);

select private.sync_completed_trust_milestones(u.id)
from public.users as u
where u.user_role = 'borrower'
   or exists (
     select 1
     from public.loans as l
     where l.borrower_user_id = u.id
   );
