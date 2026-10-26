-- Facebook name + every time a borrower contacted us on Messenger.
--
-- Until now we kept only the SendPulse contact id (users.messenger_psid). The Facebook name was read
-- from SendPulse for the "Facebook connected" alert and then thrown away, and there was no record of
-- when someone messaged the Page. Both are needed when a borrower goes quiet (e.g. chasing a payment).
--
--   users.facebook_name          — the Facebook profile name SendPulse reports for their contact.
--                                  Set on verification, refreshed whenever they message us.
--   messenger_contact_events     — one row per subscribe / message FROM the person (never our bot's
--                                  replies). Written live by sendpulse-events; older history is
--                                  pulled from SendPulse's chat log by admin-messenger 'sync_history'.

alter table public.users add column if not exists facebook_name text;

create table if not exists public.messenger_contact_events (
  id bigserial primary key,
  -- Null until the contact is linked to a borrower (a stranger, or someone mid-verification);
  -- sendpulse-messenger-verify fills it in when they connect.
  user_id uuid null references public.users(id) on delete set null,
  contact_id text not null,
  kind text not null check (kind in ('subscribe', 'message')),
  -- 'webhook' = logged live; 'history' = backfilled from SendPulse's chat log.
  source text not null check (source in ('webhook', 'history')),
  -- SendPulse's message id, when known. Lets the history sync skip messages already logged.
  sendpulse_message_id text null unique,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists messenger_contact_events_user_idx on public.messenger_contact_events (user_id, occurred_at desc);
create index if not exists messenger_contact_events_contact_idx on public.messenger_contact_events (contact_id, occurred_at desc);

-- Admins can read; only edge functions (service role) write.
alter table public.messenger_contact_events enable row level security;
revoke all on public.messenger_contact_events from anon, authenticated;
grant select on public.messenger_contact_events to authenticated;
revoke all on sequence public.messenger_contact_events_id_seq from anon, authenticated;

drop policy if exists messenger_contact_events_admin_select on public.messenger_contact_events;
create policy messenger_contact_events_admin_select on public.messenger_contact_events
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- facebook_name is written by edge functions only, like messenger_psid. A borrower's own session
-- (authenticated/anon) can't set it on insert or change it on update, so the name the team sees is
-- always the one SendPulse reported.
create or replace function app_private.keep_facebook_name_server_only()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.facebook_name := null;
  elsif new.facebook_name is distinct from old.facebook_name then
    raise exception 'users: facebook_name can only be written by verified server-side code';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_keep_facebook_name_server_only on public.users;
create trigger trg_keep_facebook_name_server_only
  before insert or update of facebook_name on public.users
  for each row execute function app_private.keep_facebook_name_server_only();
