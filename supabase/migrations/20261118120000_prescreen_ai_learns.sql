-- Pre-screening AI learns from the team (George, 2026-11-18):
--   * ❌ Not a fit now asks why (one tap: vague answers, sick family, paying other loans, income doesn't
--     match, fake-looking document, other). Saved as team_reason.
--   * The AI's prompt carries the team's latest ✅ / ❌ (+ reasons) as examples (_shared/preScreening.ts).
--   * Monday 09:00 Bangkok: how often the AI agreed with the team last week, to the Pre Screening group.
alter table public.pre_screenings add column if not exists team_reason text;

drop function if exists public.decide_pre_screening(uuid, text);

create or replace function public.decide_pre_screening(p_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
begin
  if not app_private.is_moodeng_admin() then raise exception 'admins only'; end if;
  if p_decision not in ('good', 'not_fit') then raise exception 'bad decision'; end if;
  select coalesce(nullif(u.display_name, ''), '@' || u.username, 'admin') into who from public.users u where u.id = auth.uid();
  update public.pre_screenings
     set team_decision = p_decision, team_decided_by = coalesce(who, 'admin'), team_decided_at = now(),
         team_reason = case when p_decision = 'not_fit' then nullif(left(btrim(coalesce(p_reason, '')), 200), '') end
   where id = p_id and status <> 'open';
  if not found then raise exception 'not found'; end if;
  perform app_private.pre_screening_call(jsonb_build_object('prescreen_decided', p_id));
end;
$$;

revoke all on function public.decide_pre_screening(uuid, text, text) from public, anon;
grant execute on function public.decide_pre_screening(uuid, text, text) to authenticated;

select cron.unschedule('prescreen-weekly-agreement') where exists (select 1 from cron.job where jobname = 'prescreen-weekly-agreement');
select cron.schedule('prescreen-weekly-agreement', '0 2 * * 1',
  $cron$select app_private.pre_screening_call('{"prescreen_weekly": true}'::jsonb)$cron$);
