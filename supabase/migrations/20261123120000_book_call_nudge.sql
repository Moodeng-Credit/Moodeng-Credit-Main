-- Book-your-call reminder (George, 2026-11-23): people who passed the pre-screening but never booked
-- their call get up to two reminders (Messenger + push + text), sent by loan-access action=book_nudge
-- (supabase/functions/_shared/bookCallNudge.ts). This adds the per-pre-screening counter, the text,
-- the switch and the hourly schedule. Switch: telegram_bot_settings.book_call_nudge = 'off'.

alter table public.pre_screenings add column if not exists book_nudges integer not null default 0;
alter table public.pre_screenings add column if not exists book_nudged_at timestamptz;
alter table public.pre_screenings add column if not exists book_nudge_result text;

insert into public.telegram_bot_settings (key, value) values ('book_call_nudge', 'on')
on conflict (key) do nothing;

-- The text, like prescreen_good_sms: same number (call-reminder number, sign-up phone or verified
-- WhatsApp; Philippine numbers only, UniSMS), plain words and no links. The edge function claims the
-- reminder on pre_screenings before calling this, so this only sends. Off when call_sms_reminders is off.
create or replace function private.prescreen_book_sms(p_user uuid, p_nudge integer)
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
    when 1 then 'Moodeng Credit: you passed the pre-screening! Open the Moodeng app to finish your steps and book your 15-min call. You pick the time, no invite needed.'
    else 'Moodeng Credit: your spot is still open. Open the Moodeng app and book your 15-min call, then you can ask for your first loan. You pick the time.'
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

revoke all on function private.prescreen_book_sms(uuid, integer) from public, anon, authenticated;

create or replace function public.prescreen_book_sms(p_user uuid, p_nudge integer)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.prescreen_book_sms(p_user, p_nudge);
$$;

revoke all on function public.prescreen_book_sms(uuid, integer) from public, anon, authenticated;
grant execute on function public.prescreen_book_sms(uuid, integer) to service_role;

-- Hourly at :20. The function itself only sends 09:00–21:00 Manila and never twice per reminder.
do $$
begin
  perform cron.unschedule('loan-access-book-nudge-hourly');
exception
  when others then null;
end $$;

select cron.schedule(
  'loan-access-book-nudge-hourly',
  '20 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/loan-access',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1)
    ),
    body := '{"action":"book_nudge"}'::jsonb
  )
  $$
);
