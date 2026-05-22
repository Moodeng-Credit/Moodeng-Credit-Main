drop policy if exists "admins can read point events for admin panel" on public.point_events;
create policy "admins can read point events for admin panel"
  on public.point_events
  for select
  to authenticated
  using (app_private.is_moodeng_admin());

drop policy if exists "admins can read points totals for admin panel" on public.user_points;
create policy "admins can read points totals for admin panel"
  on public.user_points
  for select
  to authenticated
  using (app_private.is_moodeng_admin());
