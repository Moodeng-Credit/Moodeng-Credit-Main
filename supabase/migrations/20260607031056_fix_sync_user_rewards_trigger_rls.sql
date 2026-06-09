-- Fix: cross-account loan funding was rolling back.
--
-- When a lender funds a loan, updateLoanStatus sets loans.loan_status='Lent'.
-- That UPDATE fires trigger sync_completed_trust_milestones_on_loans ->
-- sync_completed_trust_milestones(new.borrower_user_id) -> private.sync_user_rewards(borrower).
-- private.sync_user_rewards raised 'Users can only sync their own rewards' because
-- auth.uid() (the LENDER) <> user_id_input (the BORROWER), aborting the whole
-- transaction. The on-chain transfer had already happened, so the loan was stuck
-- "Requested" (money moved, DB not updated).
--
-- The "only sync your own rewards" guard belongs at the API boundary, not in the
-- internal function that DB triggers also invoke. Move it to public.sync_user_rewards.

-- Internal function: NO actor check (safe for trigger/system calls on any user).
create or replace function private.sync_user_rewards(user_id_input uuid)
returns table(reward_id text, unlocked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_points bigint := 0;
begin
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

-- Public API wrapper: enforce that callers can only sync their OWN rewards.
-- security invoker preserves the prior model; PostgREST only exposes public.*,
-- so this is the only API path to reward syncing.
create or replace function public.sync_user_rewards(user_id_input uuid)
returns table(reward_id text, unlocked_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() <> user_id_input then
    raise exception 'Users can only sync their own rewards' using errcode = '42501';
  end if;

  return query select * from private.sync_user_rewards(user_id_input);
end;
$$;
