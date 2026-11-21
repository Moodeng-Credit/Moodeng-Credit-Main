-- Pre-screening: the team decides right on the card (George, 2026-11-18). ✅ Good fit / ❌ Not a fit on
-- the "🎥 Pre-screening" Telegram card and in Admin → Pre-screening.
--   ✅ good     shown on their call card ("✅ Team: good fit") so the call goes their way first
--   ❌ not_fit  their account is rejected (the real reject: message + call cancelled, _shared/loanAccess
--               rejectUser) — now if they already signed up, or the moment they do (claim_pre_screening)
-- Effects run in kyc-cross-check ({"prescreen_decided": id}, _shared/preScreeningDecision.ts).

alter table public.pre_screenings add column if not exists team_decision text check (team_decision in ('good', 'not_fit'));
alter table public.pre_screenings add column if not exists team_decided_by text;
alter table public.pre_screenings add column if not exists team_decided_at timestamptz;
-- When the ❌ reject actually ran on their account (null = not yet: no account, or not run).
alter table public.pre_screenings add column if not exists team_rejected_at timestamptz;

-- Admin page: record a decision, then let the edge function act on it.
create or replace function public.decide_pre_screening(p_id uuid, p_decision text)
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
     set team_decision = p_decision, team_decided_by = coalesce(who, 'admin'), team_decided_at = now()
   where id = p_id and status <> 'open';
  if not found then raise exception 'not found'; end if;
  perform app_private.pre_screening_call(jsonb_build_object('prescreen_decided', p_id));
end;
$$;

revoke all on function public.decide_pre_screening(uuid, text) from public, anon;
grant execute on function public.decide_pre_screening(uuid, text) to authenticated;

-- The call card's line now carries the team's decision too.
create or replace function app_private.screening_line(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.pre_screenings;
  inviter text;
  verdict_label text;
begin
  select coalesce(nullif(btrim(r.display_name), ''), '@' || r.username, 'an affiliate') into inviter
  from public.friend_referrals f join public.users r on r.id = f.referrer_user_id
  where f.referred_user_id = p_user_id
  limit 1;

  select * into s from public.pre_screenings
  where user_id = p_user_id
  order by (status <> 'open') desc, created_at desc
  limit 1;

  if s.id is null then
    return case when inviter is not null then '⚠️ From ' || inviter || '’s link — no pre-screening' end;
  end if;
  if s.status = 'open' then
    return '⚠️ Started the pre-screening, didn’t finish' || coalesce(' · from ' || inviter || '’s link', '');
  end if;
  verdict_label := case s.verdict when 'good' then '🟢 Good' when 'ok' then '🟡 OK' when 'weak' then '🔴 Weak' else '⚪ Not graded' end;
  return 'Pre-screen: ' || verdict_label || coalesce(' · ' || s.score || '/100', '')
         || coalesce(' · from ' || inviter || '’s link', '')
         || case s.team_decision when 'good' then ' · ✅ Team: good fit' when 'not_fit' then ' · ❌ Team: not a fit' else '' end;
end;
$$;

revoke all on function app_private.screening_line(uuid) from public, anon, authenticated;
