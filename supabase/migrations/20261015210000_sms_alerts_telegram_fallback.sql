-- SMS alerts (failed sends, low Semaphore credit, daily cap, missing secrets) had nowhere to go:
-- the Discord webhook they read (Vault DISCORD_SMS_ALERTS_WEBHOOK_URL) doesn't exist. Fall back to
-- the team Telegram group (telegram_bot_settings.team_group_chat_id, bot token from Vault), the
-- same place the sign-in volume alarm posts.
create or replace function private.sms_alert(p_kind text, p_message text, p_window interval default interval '1 hour')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook text;
  v_token   text;
  v_chat    text;
  v_sent    boolean := false;
begin
  if exists (select 1 from private.sms_alerts where kind = p_kind and created_at > now() - p_window) then
    return;
  end if;

  select decrypted_secret into v_webhook from vault.decrypted_secrets where name = 'DISCORD_SMS_ALERTS_WEBHOOK_URL' limit 1;
  if nullif(trim(v_webhook), '') is not null then
    perform net.http_post(
      url := trim(v_webhook),
      body := jsonb_build_object('content', left('📵 SMS codes (Semaphore): ' || p_message, 1900)),
      headers := jsonb_build_object('Content-Type', 'application/json'));
    v_sent := true;
  else
    select decrypted_secret into v_token from vault.decrypted_secrets where name = 'TELEGRAM_API_TOKEN' limit 1;
    select value into v_chat from public.telegram_bot_settings where key = 'team_group_chat_id' limit 1;
    if nullif(trim(v_token), '') is not null and nullif(trim(v_chat), '') is not null then
      perform net.http_post(
        url := 'https://api.telegram.org/bot' || trim(v_token) || '/sendMessage',
        body := jsonb_build_object('chat_id', trim(v_chat), 'text', left('📵 SMS codes (Semaphore): ' || p_message, 3500)),
        headers := jsonb_build_object('Content-Type', 'application/json'));
      v_sent := true;
    end if;
  end if;

  insert into private.sms_alerts (kind, message, delivered) values (p_kind, p_message, v_sent);
end;
$$;

revoke execute on function private.sms_alert(text, text, interval) from public, anon, authenticated;
