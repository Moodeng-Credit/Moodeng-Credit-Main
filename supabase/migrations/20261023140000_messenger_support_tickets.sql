-- Messenger messages to the Moodeng Credit Page become support tickets in the same Discord system as
-- the website chat (widget_conversations + widget_messages + the #web-support forum).
--
--   in:  sendpulse-events gives each Messenger contact one widget_conversations row (channel
--        'messenger', messenger_contact_id) and posts their messages through the widget API's
--        /api/message, which saves them and relays them into the Discord ticket with Reply/Resolve.
--   out: a team reply (Reply button, Quick reply) lands in widget_messages as sender 'agent' via the
--        discord-interactions function. The trigger below hands Messenger tickets' replies to
--        sendpulse-events (?relay=1), which sends them to the person on Messenger through SendPulse.

alter table public.widget_conversations add column if not exists messenger_contact_id text;
create unique index if not exists widget_conversations_messenger_contact_idx
  on public.widget_conversations (messenger_contact_id)
  where messenger_contact_id is not null;

-- Delivery of a team reply to its channel (Messenger): stamped when sent, or why it wasn't.
alter table public.widget_messages add column if not exists channel_delivered_at timestamptz;
alter table public.widget_messages add column if not exists channel_error text;

-- What SendPulse sent for a message (trimmed), so the payload shape can be checked against real traffic.
alter table public.messenger_contact_events add column if not exists payload jsonb;

create or replace function app_private.relay_messenger_agent_reply()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_contact text;
  v_secret text;
  v_base text;
begin
  select messenger_contact_id into v_contact from public.widget_conversations where id = new.conversation_id;
  if v_contact is null then
    return new;
  end if;
  select value into v_secret from public.telegram_bot_settings where key = 'sendpulse_events_secret';
  select decrypted_secret into v_base from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL';
  if coalesce(v_secret, '') = '' then
    raise warning 'messenger relay: sendpulse_events_secret is not set; reply % not sent', new.id;
    return new;
  end if;
  perform net.http_post(
    url := rtrim(coalesce(nullif(v_base, ''), 'https://qplmmxynzxzkfxtayoqr.supabase.co'), '/') || '/functions/v1/sendpulse-events?relay=1',
    body := jsonb_build_object('relay', 'agent_reply', 'message_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-relay-secret', v_secret),
    timeout_milliseconds := 10000
  );
  return new;
end;
$$;

revoke execute on function app_private.relay_messenger_agent_reply() from public, anon, authenticated;

drop trigger if exists widget_messages_messenger_relay on public.widget_messages;
create trigger widget_messages_messenger_relay
  after insert on public.widget_messages
  for each row
  when (new.sender = 'agent')
  execute function app_private.relay_messenger_agent_reply();
