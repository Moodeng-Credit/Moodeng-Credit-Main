create table if not exists public.milestone_definitions (
  id text primary key,
  point_source_id uuid not null unique,
  title text not null,
  description text not null,
  category text not null default 'reputation',
  borrower_stage text not null default 'starter',
  points_awarded bigint not null check (points_awarded >= 0),
  reward_label text,
  outcome text,
  benefit text,
  action_label text,
  action_path text,
  rule_metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_milestone_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  milestone_id text not null references public.milestone_definitions(id) on delete restrict,
  point_event_id bigint references public.point_events(id) on delete set null,
  source_type text not null default 'milestone',
  source_id uuid not null,
  completed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, milestone_id)
);

create table if not exists public.reward_definitions (
  id text primary key,
  reward_type text not null check (reward_type in ('avatar_ring', 'profile_badge', 'collectible')),
  title text not null,
  description text not null,
  required_points_total bigint not null check (required_points_total >= 0),
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.user_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  reward_id text not null references public.reward_definitions(id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  source_type text not null default 'trust_points',
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, reward_id)
);

create table if not exists public.user_reward_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  selected_avatar_ring_reward_id text references public.reward_definitions(id) on delete set null,
  selected_profile_badge_reward_id text references public.reward_definitions(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists user_milestone_completions_user_completed_idx
  on public.user_milestone_completions (user_id, completed_at desc);

create index if not exists user_rewards_user_unlocked_idx
  on public.user_rewards (user_id, unlocked_at desc);

alter table public.milestone_definitions enable row level security;
alter table public.user_milestone_completions enable row level security;
alter table public.reward_definitions enable row level security;
alter table public.user_rewards enable row level security;
alter table public.user_reward_preferences enable row level security;

drop policy if exists "Milestone definitions are readable" on public.milestone_definitions;
create policy "Milestone definitions are readable"
  on public.milestone_definitions
  for select
  using (is_active = true);

drop policy if exists "Users can read their own milestone completions" on public.user_milestone_completions;
create policy "Users can read their own milestone completions"
  on public.user_milestone_completions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Reward definitions are readable" on public.reward_definitions;
create policy "Reward definitions are readable"
  on public.reward_definitions
  for select
  using (is_active = true);

drop policy if exists "Users can read their own rewards" on public.user_rewards;
create policy "Users can read their own rewards"
  on public.user_rewards
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own reward preferences" on public.user_reward_preferences;
create policy "Users can read their own reward preferences"
  on public.user_reward_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own reward preferences" on public.user_reward_preferences;
create policy "Users can insert their own reward preferences"
  on public.user_reward_preferences
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      selected_avatar_ring_reward_id is null
      or exists (
        select 1
        from public.user_rewards
        where user_rewards.user_id = auth.uid()
          and user_rewards.reward_id = selected_avatar_ring_reward_id
      )
    )
    and (
      selected_profile_badge_reward_id is null
      or exists (
        select 1
        from public.user_rewards
        where user_rewards.user_id = auth.uid()
          and user_rewards.reward_id = selected_profile_badge_reward_id
      )
    )
  );

drop policy if exists "Users can update their own reward preferences" on public.user_reward_preferences;
create policy "Users can update their own reward preferences"
  on public.user_reward_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      selected_avatar_ring_reward_id is null
      or exists (
        select 1
        from public.user_rewards
        where user_rewards.user_id = auth.uid()
          and user_rewards.reward_id = selected_avatar_ring_reward_id
      )
    )
    and (
      selected_profile_badge_reward_id is null
      or exists (
        select 1
        from public.user_rewards
        where user_rewards.user_id = auth.uid()
          and user_rewards.reward_id = selected_profile_badge_reward_id
      )
    )
  );

grant select on public.milestone_definitions to anon, authenticated;
grant select on public.reward_definitions to anon, authenticated;
grant select on public.user_milestone_completions to authenticated;
grant select on public.user_rewards to authenticated;
grant select, insert, update on public.user_reward_preferences to authenticated;

insert into public.milestone_definitions (
  id,
  point_source_id,
  title,
  description,
  category,
  borrower_stage,
  points_awarded,
  reward_label,
  outcome,
  benefit,
  action_label,
  action_path,
  rule_metadata
)
values
  ('verify-identity', '9c826a2d-2fc8-43b5-95b6-09d7f21f1e01', 'Verify your identity', 'Unlock borrowing and start building your public trust record.', 'basics', 'starter', 10000000, 'Borrowing unlocked', 'Borrowing unlocked', 'Verified profile', 'Verify now', '/verify-world-id', '{"rule":"world_id_active"}'),
  ('first-loan-request', '6cb37536-68e5-4d38-a2eb-ef850b69c7ad', 'Post your first loan request', 'Ask for a small amount with a clear reason and due date.', 'basics', 'starter', 10000000, 'Visible to lenders', 'Visible to lenders', 'Request live', 'Request a loan', '/request-board', '{"rule":"borrower_has_loan_request"}'),
  ('first-funded-loan', 'a030a2e0-3955-443a-b2c7-e1ac03f0319f', 'Get funded by a lender', 'A lender accepts your request and trusts you with your first loan.', 'funding', 'starter', 15000000, 'First lender signal', 'Lender signal gained', 'History started', 'View requests', '/request-board', '{"rule":"funded_loans_gte","value":1}'),
  ('first-on-time-repayment', '30898ca5-6a8f-4275-8b33-56d5d797435b', 'Repay a loan on time', 'Pay the full amount before the due date to start your repayment record.', 'repayment', 'starter', 20000000, 'Trust Points earned', 'Trust Points earned', 'Limit progress', 'Pay loans', '/repay', '{"rule":"on_time_repaid_loans_gte","value":1}'),
  ('two-on-time-streak', 'f7c1c0d2-93a9-404d-925c-7201d20d0d84', 'Build a 2-loan on-time streak', 'Show lenders that your repayment reliability is repeatable.', 'repayment', 'builder', 25000000, 'Stronger lender confidence', 'Reliability improved', 'Stronger profile', 'Keep building', '/repay', '{"rule":"on_time_repaid_loans_gte","value":2}'),
  ('full-limit-credit-builder', '1e10653e-46ce-4c8d-b2ef-738f3c55a7c9', 'Repay a full-limit credit-builder', 'Use your current Credit Level amount and repay it on time.', 'credit_level', 'builder', 30000000, 'Credit Level progress', 'Level progress', 'Higher limit path', 'Learn levels', '/credit-leveling-guide', '{"rule":"repaid_full_credit_tier"}'),
  ('two-unique-lenders', '05d358b1-ce9b-49ec-9fd6-61611c1e4e37', 'Borrow from 2 different lenders', 'Build a reputation that does not depend on just one lender.', 'lender_diversity', 'builder', 30000000, 'Lender diversity signal', 'Diversity improved', 'Broader trust', 'Request a loan', '/request-board', '{"rule":"unique_lenders_gte","value":2}'),
  ('repay-100-total', 'e4a7c7cb-2a88-483e-ad57-a79b35e1a32b', 'Repay $100 total', 'Grow from starter loans into a real repayment history.', 'repayment_volume', 'builder', 40000000, 'Volume trust signal', 'Volume signal', '$100 repaid', 'Pay loans', '/repay', '{"rule":"total_repaid_gte","value":100}'),
  ('reach-level-three', 'fe748497-60b8-4545-b44c-3f77c7172dc6', 'Reach Credit Level 3', 'Unlock a higher borrowing limit through verified on-time repayment.', 'credit_level', 'veteran', 50000000, 'Higher borrowing power', 'Higher limit unlocked', 'Level 3', 'View guide', '/credit-leveling-guide', '{"rule":"credit_level_gte","value":3}'),
  ('trusted-borrower-candidate', '3d321dad-0854-4f4b-aa95-5441a8f77099', 'Become a trusted borrower candidate', 'Complete 5 on-time repayments, use 3 lenders, and keep defaults resolved.', 'top_milestone', 'veteran', 75000000, 'Future top-user perks', 'Priority signal', 'Review ready', 'Keep building', '/repay', '{"rule":"trusted_candidate","on_time_repaid_loans_gte":5,"unique_lenders_gte":3,"requires_no_unresolved_defaults":true}')
on conflict (id) do update
set point_source_id = excluded.point_source_id,
    title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    borrower_stage = excluded.borrower_stage,
    points_awarded = excluded.points_awarded,
    reward_label = excluded.reward_label,
    outcome = excluded.outcome,
    benefit = excluded.benefit,
    action_label = excluded.action_label,
    action_path = excluded.action_path,
    rule_metadata = excluded.rule_metadata,
    is_active = true,
    updated_at = now();

insert into public.reward_definitions (
  id,
  reward_type,
  title,
  description,
  required_points_total,
  metadata
)
values
  ('silver-avatar-ring', 'avatar_ring', 'Silver avatar ring', 'A clean profile ring around your avatar.', 50000000, '{"ring":"silver"}'),
  ('gold-avatar-ring', 'avatar_ring', 'Gold avatar ring', 'A stronger profile ring for repeat borrowers.', 120000000, '{"ring":"gold"}'),
  ('trusted-profile-badge', 'profile_badge', 'Trusted profile badge', 'A visible badge on your borrower profile.', 250000000, '{"badge":"trusted_profile"}'),
  ('top-borrower-award', 'collectible', 'Top borrower award', 'A collectible profile award for long-term history.', 500000000, '{"award":"top_borrower"}')
on conflict (id) do update
set reward_type = excluded.reward_type,
    title = excluded.title,
    description = excluded.description,
    required_points_total = excluded.required_points_total,
    metadata = excluded.metadata,
    is_active = true;

create schema if not exists private;

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

  select coalesce(up.points_total, 0)
  into current_points
  from public.user_points as up
  where up.user_id = user_id_input;

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

create or replace function public.sync_user_rewards(user_id_input uuid)
returns table(reward_id text, unlocked_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.sync_user_rewards($1);
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
    from public.award_points(
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
    set point_event_id = awarded_event_id
    where id = inserted_completion_id;
  end if;

  perform private.sync_user_rewards(user_id_input);

  select coalesce(up.points_total, 0)
  into current_total
  from public.user_points as up
  where up.user_id = user_id_input;

  return query
  select
    inserted_completion_id is not null,
    milestone_record.id,
    coalesce(awarded_points_total, current_total, 0);
end;
$$;

create or replace function public.record_milestone_completion(
  user_id_input uuid,
  milestone_id_input text,
  metadata_input jsonb default '{}'::jsonb
)
returns table(applied boolean, milestone_id text, points_total bigint)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.record_milestone_completion($1, $2, $3);
$$;

revoke all on function public.sync_user_rewards(uuid) from public;
grant execute on function public.sync_user_rewards(uuid) to authenticated;

revoke all on function public.record_milestone_completion(uuid, text, jsonb) from public;
grant execute on function public.record_milestone_completion(uuid, text, jsonb) to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.sync_user_rewards(uuid) to authenticated;
grant execute on function private.record_milestone_completion(uuid, text, jsonb) to authenticated;
