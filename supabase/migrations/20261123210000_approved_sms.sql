-- "You're approved" by text for people with no real email (phone / TikTok sign-ups: placeholder
-- address), so the approval isn't push + Messenger only (Messenger fails outside Meta's 24h window).
-- Same number and sender as prescreen_book_sms (call-reminder number, sign-up phone or verified
-- WhatsApp; Philippine numbers, UniSMS), plain words and no links. Called once by notifyBorrower
-- (_shared/loanAccess.ts) right after the conditional approve. Off when call_sms_reminders is off.
create or replace function private.approved_sms(p_user uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits   text;
  v_key      text;
  v_sender   text;
  v_response extensions.http_response;
begin
  if not private.call_sms_enabled() then return 'off'; end if;

  v_digits := coalesce(private.call_sms_digits(p_user),
                       private.call_sms_normalize((select whatsapp_number from public.users where id = p_user)));
  if v_digits is null then return 'no_number'; end if;

  select nullif(btrim(decrypted_secret), '') into v_key from vault.decrypted_secrets where name = 'UNISMS_SECRET_KEY' limit 1;
  select nullif(btrim(decrypted_secret), '') into v_sender from vault.decrypted_secrets where name = 'UNISMS_SENDER_ID' limit 1;
  if v_key is null or v_sender is null then return 'failed'; end if;

  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '1500');
    v_response := extensions.http((
      'POST',
      'https://unismsapi.com/api/sms',
      array[extensions.http_header('Authorization',
        'Basic ' || replace(encode(convert_to(v_key || ':', 'UTF8'), 'base64'), E'\n', ''))],
      'application/json',
      jsonb_build_object('recipient', '+' || v_digits,
        'content', 'Moodeng Credit: you''re approved! Open the Moodeng app and tap Borrow to ask for your first loan. The last step is a quick ID check.',
        'sender_id', v_sender)::text
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

revoke all on function private.approved_sms(uuid) from public, anon, authenticated;

create or replace function public.approved_sms(p_user uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select private.approved_sms(p_user);
$$;

revoke all on function public.approved_sms(uuid) from public, anon, authenticated;
grant execute on function public.approved_sms(uuid) to service_role;
