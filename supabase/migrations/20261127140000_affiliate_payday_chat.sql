-- Payday cards (15th / 30th) go to their own Telegram chat (George, 2026-11-27), and the tick runs on every payday
-- even when nothing is owed, so the chat gets a "nothing to pay" line and the team knows it ran.

insert into public.telegram_bot_settings (key, value)
values ('affiliate_payday_chat_id', '-5473058483')
on conflict (key) do update set value = excluded.value;

create or replace function private.affiliate_payday_tick(p_force boolean default false)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  project_url text;
  service_key text;
begin
  if not p_force and v_today <> app_private.affiliate_payday(v_today) then
    return false;
  end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;
  if project_url is null or service_key is null then
    raise warning 'Affiliate payday skipped: project URL or secret key missing from vault.';
    return false;
  end if;
  perform net.http_post(
    url := project_url || '/functions/v1/referral-payout-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('payday', v_today));
  return true;
end;
$function$;
revoke all on function private.affiliate_payday_tick(boolean) from public, anon, authenticated;
