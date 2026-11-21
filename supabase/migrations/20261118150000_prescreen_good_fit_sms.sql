-- Pre-screening ✅ Good fit also goes out as a text (George, 2026-11-18). Messenger only reaches people
-- within 24 hours of their last message to us, so a ✅ tapped a day later would never arrive. A text
-- has no window. Number: the one they gave for call reminders, their confirmed sign-up phone, or their
-- verified WhatsApp number (Philippine numbers only — UniSMS, like the call reminders; Smart/TNT/Sun
-- numbers are refused by the network). Plain words, no links (networks refuse texts with links).
-- One text per pre-screening (pre_screenings.good_sms_at). Off when call_sms_reminders is off.

alter table public.pre_screenings add column if not exists good_sms_at timestamptz;
alter table public.pre_screenings add column if not exists good_sms_result text;

create or replace function private.prescreen_good_sms(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ps       uuid;
  v_digits   text;
  v_key      text;
  v_sender   text;
  v_response extensions.http_response;
  v_result   text;
begin
  if not private.call_sms_enabled() then return 'off'; end if;

  -- Claim it: one text per pre-screening, ever.
  update public.pre_screenings set good_sms_at = now()
   where id = (select id from public.pre_screenings
                where user_id = p_user and team_decision = 'good' and good_sms_at is null
                order by team_decided_at desc nulls last limit 1)
  returning id into v_ps;
  if v_ps is null then return 'already'; end if;

  v_digits := coalesce(private.call_sms_digits(p_user),
                       private.call_sms_normalize((select whatsapp_number from public.users where id = p_user)));
  if v_digits is null then
    update public.pre_screenings set good_sms_result = 'no_number' where id = v_ps;
    return 'no_number';
  end if;

  select nullif(btrim(decrypted_secret), '') into v_key from vault.decrypted_secrets where name = 'UNISMS_SECRET_KEY' limit 1;
  select nullif(btrim(decrypted_secret), '') into v_sender from vault.decrypted_secrets where name = 'UNISMS_SENDER_ID' limit 1;
  if v_key is null or v_sender is null then
    update public.pre_screenings set good_sms_result = 'no_key' where id = v_ps;
    return 'failed';
  end if;

  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '1500');
    v_response := extensions.http((
      'POST',
      'https://unismsapi.com/api/sms',
      array[extensions.http_header('Authorization',
        'Basic ' || replace(encode(convert_to(v_key || ':', 'UTF8'), 'base64'), E'\n', ''))],
      'application/json',
      jsonb_build_object('recipient', '+' || v_digits,
        'content', 'Moodeng Credit: good news! The team read your answers and you can keep going. Open the Moodeng app to set up your wallet and book your 15-min call.',
        'sender_id', v_sender)::text
    )::extensions.http_request);
  exception when others then
    update public.pre_screenings set good_sms_result = 'unconfirmed' where id = v_ps;
    return 'unconfirmed';
  end;

  v_result := case
    when v_response.status between 200 and 299 then 'sent'
    when v_response.status = 422 and v_response.content ~* 'smart|tnt|sun' then 'rejected_network'
    else 'failed' end;
  update public.pre_screenings set good_sms_result = v_result where id = v_ps;
  return v_result;
exception when others then
  return 'failed';
end;
$$;

revoke all on function private.prescreen_good_sms(uuid) from public, anon, authenticated;

create or replace function public.prescreen_good_sms(p_user uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.prescreen_good_sms(p_user);
$$;

revoke all on function public.prescreen_good_sms(uuid) from public, anon, authenticated;
grant execute on function public.prescreen_good_sms(uuid) to service_role;
