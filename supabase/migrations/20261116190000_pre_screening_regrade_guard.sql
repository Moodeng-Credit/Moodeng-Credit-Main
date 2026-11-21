-- Pre-screening: "Grade again" must not run once the clips have been removed (30 days, never signed
-- up) — with nothing left to hear it would replace the saved transcripts and score with "failed".
create or replace function public.regrade_pre_screening(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app_private.is_moodeng_admin() then raise exception 'admins only'; end if;
  if not exists (select 1 from public.pre_screenings where id = p_id and status <> 'open') then raise exception 'not found'; end if;
  if exists (select 1 from public.pre_screenings where id = p_id and files_removed_at is not null) then
    raise exception 'The clips were removed, so there is nothing to grade again.';
  end if;
  perform app_private.pre_screening_call(jsonb_build_object('prescreen', p_id, 'quiet', true));
end;
$$;

revoke all on function public.regrade_pre_screening(uuid) from public, anon;
grant execute on function public.regrade_pre_screening(uuid) to authenticated;
