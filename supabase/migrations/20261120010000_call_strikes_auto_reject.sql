-- Call strikes → automatic rejection (George, 2026-11-19).
--
-- A borrower who misses 2 calls (no-show, or never tapped ✅ so the slot was freed) or reschedules
-- 3 times is rejected automatically, told why, and the reason is recorded here.
--
-- public.call_events: what a borrower did with their call that the other tables don't keep.
--   booked       they booked a time themselves (app, Messenger bot, WhatsApp — all via bookCall)
--   moved        they moved their call on Cal.com (its reschedule link)
--   team_moved   the team moved it (🔄 Change time) — never counted against them
--   unconfirmed  the slot was freed because they never tapped ✅ (open flow had no record of this)
-- Kept apart from video_call_no_shows, which other functions read as "any row = a missed call".

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('booked', 'moved', 'team_moved', 'unconfirmed')),
  call_at timestamptz,
  recorded_at timestamptz not null default now()
);
create index if not exists call_events_user_idx on public.call_events (user_id, recorded_at desc);
alter table public.call_events enable row level security;
revoke all on public.call_events from anon, authenticated;
grant select on public.call_events to authenticated;
drop policy if exists "admins read call events" on public.call_events;
create policy "admins read call events" on public.call_events for select to authenticated using (app_private.is_moodeng_admin());

-- Why an account was rejected automatically: 'missed_calls' | 'too_many_reschedules'. Null for a
-- team reject. Cleared by nothing on purpose — /reopen leaves the history.
alter table public.users add column if not exists loan_access_reject_reason text;
