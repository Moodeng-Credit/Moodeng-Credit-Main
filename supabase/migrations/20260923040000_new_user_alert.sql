-- Restore the #new-users Discord feed.
--
-- The `new-users` (AFTER INSERT) and `kyc` (AFTER UPDATE) database webhooks on public.users posted
-- to the support widget app (web-iota-sage-38.vercel.app/api/hooks/*). Both routes have returned
-- 404 since mid-August 2026, so no sign-up alert has reached Discord since, and every users
-- update fired a dead HTTP call. KYC alerts already post to Discord from our own edge functions,
-- so the `kyc` hook is simply dropped.
--
-- Sign-ups now post straight from the database: the trigger builds the embed from the new row and
-- sends it with pg_net (fire-and-forget, so a Discord outage can never block a sign-up). The
-- webhook URL lives in the vault as DISCORD_NEW_USERS_WEBHOOK_URL; if it's missing, nothing posts.

drop trigger if exists "new-users" on public.users;
drop trigger if exists kyc on public.users;

create or replace function private.notify_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  webhook text := (select decrypted_secret from vault.decrypted_secrets where name = 'DISCORD_NEW_USERS_WEBHOOK_URL' limit 1);
  display text := coalesce(nullif(trim(new.display_name), ''), nullif(trim(new.username), ''), 'Someone');
  fields jsonb := jsonb_build_array(jsonb_build_object('name', 'Email', 'value', coalesce(nullif(trim(new.email), ''), '—'), 'inline', true));
begin
  if webhook is null then
    return new;
  end if;
  if nullif(trim(new.telegram_username), '') is not null then
    fields := fields || jsonb_build_object('name', 'Telegram', 'value', '@' || ltrim(trim(new.telegram_username), '@'), 'inline', true);
  end if;
  if new.username is not null and new.username <> display then
    fields := fields || jsonb_build_object('name', 'Username', 'value', new.username, 'inline', true);
  end if;

  perform net.http_post(
    url := webhook,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('embeds', jsonb_build_array(jsonb_build_object(
      'title', '👤 New user',
      'description', '**' || display || '** just joined.',
      'color', 5763719,
      'fields', fields,
      'timestamp', coalesce(new.created_at, now())
    )))
  );
  return new;
end;
$$;

drop trigger if exists notify_new_user on public.users;
create trigger notify_new_user
after insert on public.users
for each row
execute function private.notify_new_user();
