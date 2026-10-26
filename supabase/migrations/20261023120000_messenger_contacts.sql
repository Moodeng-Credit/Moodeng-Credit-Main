-- Everyone who has messaged the Moodeng Credit Page, registered or not.
--
-- messenger_contact_events logs each message, but a stranger's row is just a SendPulse contact id —
-- their Facebook name was only kept once they were a borrower (users.facebook_name). Now every person
-- who writes to the Page gets one row here with the name SendPulse reports, so the team knows who
-- they are before they sign up, and the row is linked to their account when they connect Facebook.
--
-- Meta never gives us a link to their real profile (only a Page-scoped id); "View profile" in the Page
-- inbox is where the team opens it.

create table if not exists public.messenger_contacts (
  contact_id text primary key,
  facebook_name text null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  message_count integer not null default 0,
  -- Null while they are a stranger; set by sendpulse-messenger-verify when they connect Facebook.
  user_id uuid null references public.users(id) on delete set null,
  linked_at timestamptz null
);

create index if not exists messenger_contacts_user_idx on public.messenger_contacts (user_id);
create index if not exists messenger_contacts_last_seen_idx on public.messenger_contacts (last_seen_at desc);

-- Admins can read; only edge functions (service role) write.
alter table public.messenger_contacts enable row level security;
revoke all on public.messenger_contacts from anon, authenticated;
grant select on public.messenger_contacts to authenticated;

drop policy if exists messenger_contacts_admin_select on public.messenger_contacts;
create policy messenger_contacts_admin_select on public.messenger_contacts
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- Backfill from what we already logged; names come from the borrower they're linked to.
insert into public.messenger_contacts (contact_id, facebook_name, first_seen_at, last_seen_at, message_count, user_id, linked_at)
select
  e.contact_id,
  max(u.facebook_name),
  min(e.occurred_at),
  max(e.occurred_at),
  count(*) filter (where e.kind = 'message'),
  (array_agg(e.user_id) filter (where e.user_id is not null))[1],
  case when bool_or(e.user_id is not null) then now() end
from public.messenger_contact_events e
left join public.users u on u.id = e.user_id
group by e.contact_id
on conflict (contact_id) do nothing;

-- Borrowers linked before any message was logged.
insert into public.messenger_contacts (contact_id, facebook_name, first_seen_at, last_seen_at, user_id, linked_at)
select u.messenger_psid, u.facebook_name, coalesce(u.messenger_verified_at, now()), coalesce(u.messenger_verified_at, now()), u.id, now()
from public.users u
where u.messenger_psid is not null
on conflict (contact_id) do nothing;
