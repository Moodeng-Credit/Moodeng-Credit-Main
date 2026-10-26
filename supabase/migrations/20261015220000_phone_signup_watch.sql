-- Phone (SMS code) sign-in went live 2026-10-15 without a real-phone test, and Openfort (Instant
-- Wallet) was never tried with an account that has no email. Watch the first phone sign-ups:
--   - one Telegram message to the team group when the first phone-only account appears, and
--   - an alert whenever a phone-only account shares a wallet address with any other account
--     (would mean Openfort merged accounts without an email into one wallet).
-- Dedupe uses private.auth_send_volume_alerts (kind primary key).
create or replace function private.check_phone_signups()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token  text;
  v_chat   text;
  v_first  record;
  v_shared record;
  v_msgs   text[] := '{}';
  v_msg    text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'TELEGRAM_API_TOKEN' limit 1;
  select value into v_chat from public.telegram_bot_settings where key = 'team_group_chat_id' limit 1;

  -- First phone-only sign-up.
  if not exists (select 1 from private.auth_send_volume_alerts where kind = 'first_phone_signup') then
    select u.id, u.created_at, w.wallet_address
      into v_first
      from auth.users u
      left join public.users w on w.id = u.id
     where coalesce(u.phone, '') <> '' and coalesce(u.email, '') = ''
     order by u.created_at
     limit 1;
    if v_first.id is not null then
      v_msgs := v_msgs || format(
        E'📱 First phone (SMS code) sign-up on Moodeng.\nAccount %s · wallet: %s\nPlease check it can create and use its Instant Wallet.',
        v_first.id, coalesce(v_first.wallet_address, 'not created yet'));
      insert into private.auth_send_volume_alerts (kind, last_alert_at) values ('first_phone_signup', now())
      on conflict (kind) do nothing;
    end if;
  end if;

  -- A phone-only account sharing a wallet with another account.
  for v_shared in
    select lower(w.wallet_address) as addr, count(*) as accounts
      from public.users w
     where coalesce(w.wallet_address, '') <> ''
     group by lower(w.wallet_address)
    having count(*) > 1
       and bool_or(exists (
             select 1 from auth.users u
              where u.id = w.id and coalesce(u.phone, '') <> '' and coalesce(u.email, '') = ''))
  loop
    continue when exists (select 1 from private.auth_send_volume_alerts where kind = 'shared_wallet:' || v_shared.addr);
    v_msgs := v_msgs || format(
      E'🚨 %s Moodeng accounts share wallet %s, and at least one signed up by phone. Openfort may be merging phone accounts. Stop phone sign-ups (Vercel VITE_SMS_LOGIN_ENABLED) and check.',
      v_shared.accounts, v_shared.addr);
    insert into private.auth_send_volume_alerts (kind, last_alert_at) values ('shared_wallet:' || v_shared.addr, now())
    on conflict (kind) do nothing;
  end loop;

  if nullif(trim(v_token), '') is not null and nullif(trim(v_chat), '') is not null then
    foreach v_msg in array v_msgs loop
      perform net.http_post(
        url := 'https://api.telegram.org/bot' || trim(v_token) || '/sendMessage',
        body := jsonb_build_object('chat_id', trim(v_chat), 'text', v_msg),
        headers := '{"Content-Type": "application/json"}'::jsonb);
    end loop;
  end if;

  return jsonb_build_object('alerts', coalesce(array_length(v_msgs, 1), 0));
end;
$$;

revoke execute on function private.check_phone_signups() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'phone-signup-watch';
select cron.schedule('phone-signup-watch', '*/10 * * * *', $$select private.check_phone_signups();$$);
