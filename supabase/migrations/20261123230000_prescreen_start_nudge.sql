-- Finish-your-pre-screening reminder (George, 2026-11-23): people on the pre-screening path who
-- connected Facebook but never sent the pre-screening get up to two reminders (Messenger + push +
-- text + WhatsApp), sent by loan-access action=start_nudge (supabase/functions/_shared/prescreenStartNudge.ts).
-- This adds the per-user counter, the text, the switch (off until a dry run looks right) and the
-- hourly schedule. Switch: telegram_bot_settings.prescreen_start_nudge = 'on' / 'off'.

alter table public.users add column if not exists prescreen_start_nudges integer not null default 0;
alter table public.users add column if not exists prescreen_start_nudged_at timestamptz;
alter table public.users add column if not exists prescreen_start_nudge_result text;

insert into public.telegram_bot_settings (key, value) values ('prescreen_start_nudge', 'off')
on conflict (key) do nothing;

-- The text, like prescreen_book_sms: same number lookup, Philippine numbers only (UniSMS), plain
-- words and no links. The edge function claims the reminder on users before calling this.
create or replace function private.prescreen_start_sms(p_user uuid, p_nudge integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits   text;
  v_key      text;
  v_sender   text;
  v_text     text;
  v_response extensions.http_response;
begin
  if p_nudge not in (1, 2) then return 'bad_nudge'; end if;
  if not private.call_sms_enabled() then return 'off'; end if;

  v_digits := coalesce(private.call_sms_digits(p_user),
                       private.call_sms_normalize((select whatsapp_number from public.users where id = p_user)));
  if v_digits is null then return 'no_number'; end if;

  select nullif(btrim(decrypted_secret), '') into v_key from vault.decrypted_secrets where name = 'UNISMS_SECRET_KEY' limit 1;
  select nullif(btrim(decrypted_secret), '') into v_sender from vault.decrypted_secrets where name = 'UNISMS_SENDER_ID' limit 1;
  if v_key is null or v_sender is null then return 'failed'; end if;

  v_text := case p_nudge
    when 1 then 'Moodeng Credit: you''re almost in! Open the Moodeng app and answer a few questions about your work and income (about 10 min). Then you book your call.'
    else 'Moodeng Credit: your spot is still open. Open the Moodeng app and finish the short questions about your work and income, then book your call.'
  end;

  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '1500');
    v_response := extensions.http((
      'POST',
      'https://unismsapi.com/api/sms',
      array[extensions.http_header('Authorization',
        'Basic ' || replace(encode(convert_to(v_key || ':', 'UTF8'), 'base64'), E'\n', ''))],
      'application/json',
      jsonb_build_object('recipient', '+' || v_digits, 'content', v_text, 'sender_id', v_sender)::text
    )::extensions.http_request);
  exception when others then
    return 'unconfirmed';
  end;

  return case
    when v_response.status between 200 and 299 then 'sent'
    when v_response.status = 422 and v_response.content ~* 'smart|tnt|sun' then 'rejected_network'
    else 'failed' end;
exception when others then
  return 'failed';
end;
$$;

revoke all on function private.prescreen_start_sms(uuid, integer) from public, anon, authenticated;

create or replace function public.prescreen_start_sms(p_user uuid, p_nudge integer)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.prescreen_start_sms(p_user, p_nudge);
$$;

revoke all on function public.prescreen_start_sms(uuid, integer) from public, anon, authenticated;
grant execute on function public.prescreen_start_sms(uuid, integer) to service_role;

-- Hourly at :40. The function itself only sends 09:00–21:00 Manila and never twice per reminder.
do $$
begin
  perform cron.unschedule('loan-access-start-nudge-hourly');
exception
  when others then null;
end $$;

select cron.schedule(
  'loan-access-start-nudge-hourly',
  '40 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/loan-access',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1)
    ),
    body := '{"action":"start_nudge"}'::jsonb
  )
  $$
);
