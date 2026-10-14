-- Borrowers left out of the monthly lending-goal plan on admin → Growth → Marketing (money set aside for them,
-- or no longer lent to). Admins only.
create table if not exists public.goal_excluded_users (
  user_id uuid primary key references public.users(id) on delete cascade,
  reason text null,
  created_at timestamptz not null default now()
);

alter table public.goal_excluded_users enable row level security;
revoke all on public.goal_excluded_users from anon;
grant select, insert, update, delete on public.goal_excluded_users to authenticated;
drop policy if exists goal_excluded_users_admin_all on public.goal_excluded_users;
create policy goal_excluded_users_admin_all on public.goal_excluded_users
  for all to authenticated using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());

-- George, 2026-10-12: Belle's $100 is set-aside money; Jaja is out.
insert into public.goal_excluded_users (user_id, reason)
select u.id, v.reason
from (values ('d.rosebellejane-28cd3b', 'Set-aside money (Belle)'), ('jollysakura19-2b8f97', 'Out: repaid late twice')) as v(username, reason)
join public.users u on u.username = v.username
on conflict (user_id) do nothing;
