-- Admin: see and set a borrower's credit ladder on /admin/user/:id (George, 2026-11-27: "nowhere in admin
-- to see or change someone's ladder"). The ladder comes from app_private.limit_ceiling: a team number
-- (borrower_limit_ceilings) wins, else approved income proof, else the sign-up answer.

create or replace function public.admin_limit_ceiling(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_team public.borrower_limit_ceilings%rowtype;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into v_team from public.borrower_limit_ceilings where user_id = p_user;
  return app_private.limit_ceiling(p_user)
    || jsonb_build_object('team_ceiling', v_team.ceiling_usd, 'team_note', v_team.note, 'team_set_at', v_team.set_at);
end;
$function$;

-- p_ceiling null = clear the team's number (back to income proof / sign-up). Whole dollars, $15–$140.
create or replace function public.admin_set_limit_ceiling(p_user uuid, p_ceiling numeric, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not private.current_user_is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_ceiling is null then
    delete from public.borrower_limit_ceilings where user_id = p_user;
  else
    if p_ceiling <> round(p_ceiling) or p_ceiling < 15 or p_ceiling > 140 then
      raise exception 'Ceiling must be a whole number of dollars from 15 to 140' using errcode = '22023';
    end if;
    insert into public.borrower_limit_ceilings (user_id, ceiling_usd, note, set_by, set_at)
    values (p_user, p_ceiling, nullif(trim(p_note), ''), auth.uid(), now())
    on conflict (user_id) do update
      set ceiling_usd = excluded.ceiling_usd, note = excluded.note, set_by = excluded.set_by, set_at = excluded.set_at;
  end if;
  insert into public.admin_audit_logs (actor_user_id, action, target_table, target_user_id, metadata)
  values (auth.uid(), 'limit_ceiling_set', 'borrower_limit_ceilings', p_user,
    jsonb_build_object('ceiling', p_ceiling, 'note', nullif(trim(p_note), '')));
  return public.admin_limit_ceiling(p_user);
end;
$function$;

revoke all on function public.admin_limit_ceiling(uuid) from public, anon;
revoke all on function public.admin_set_limit_ceiling(uuid, numeric, text) from public, anon;
grant execute on function public.admin_limit_ceiling(uuid) to authenticated;
grant execute on function public.admin_set_limit_ceiling(uuid, numeric, text) to authenticated;
