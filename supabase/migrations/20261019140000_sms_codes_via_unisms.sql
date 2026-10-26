-- SMS codes through UniSMS while Semaphore has no sender name.
--
-- Semaphore banned both sender names we applied for (MOODENG, MOOCREDIT) and refuses its default
-- one ("The senderName supplied is not valid", 19 Oct 2026), so no Semaphore text can go out.
-- UniSMS gives every account a default sender ID that reaches Globe and DITO numbers but not Smart,
-- TNT or Sun. Its own sender IDs need Philippine business papers (DTI/SEC, BIR 2303, mayor's permit).
--
-- The Send SMS hook keeps its name (Auth > Hooks still points at public.send_sms_semaphore) and its
-- rules (PH only, 60s cooldown, 5/day per number, 300/day overall). New: once Vault holds
-- UNISMS_SECRET_KEY and UNISMS_SENDER_ID, it sends through UniSMS instead of Semaphore. Without
-- UNISMS_SECRET_KEY it behaves exactly as before.
--
-- UniSMS is called with the http extension (waits for the answer) rather than pg_net (fire and
-- forget), because UniSMS refuses a Smart/TNT/Sun number on the spot (HTTP 422, no credit used) and
-- the person should be told to use email right away instead of waiting for a text that never comes.
-- We wait at most 1.5s: on a timeout the text may still go out, so it's logged as 'sent' with
-- failure_reason 'unconfirmed: timed out' and the person is told to look out for it.
--
-- Privacy: nothing from the request or the response is stored (both hold the code); the log keeps
-- the salted number hash, the outcome and, for failures, the HTTP status only.

create extension if not exists http with schema extensions;

alter table private.sms_otp_sends drop constraint if exists sms_otp_sends_status_check;
alter table private.sms_otp_sends add constraint sms_otp_sends_status_check check (status in (
  'queued', 'sent', 'failed',
  'rejected_non_ph', 'rejected_cooldown', 'rejected_daily_cap', 'rejected_global_cap', 'rejected_network',
  'error_no_api_key', 'error_no_salt', 'error_bad_payload', 'error_no_sender'));

create or replace function public.send_sms_semaphore(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits     text := private.sms_otp_target_digits(event);
  v_otp        text := event -> 'sms' ->> 'otp';
  v_hash       text;
  v_decision   text;
  v_api_key    text;
  v_sender     text;
  v_unisms_key text;
  v_body       jsonb;
  v_request    bigint;
  v_response   extensions.http_response;
  v_unavailable constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 500,
    'message', 'Text codes are not available right now. Use your email instead.'));
begin
  v_hash := private.sms_phone_hash(v_digits);
  if v_hash is null then
    insert into private.sms_otp_sends (phone_hash, status) values ('no-salt', 'error_no_salt');
    perform private.sms_alert('no_salt', 'Vault secret SMS_PHONE_HASH_SALT is missing, so no texts are being sent.');
    return v_unavailable;
  end if;

  if v_digits !~ '^639[0-9]{9}$' then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'rejected_non_ph');
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'SMS codes work for Philippine numbers only. Use your email instead.'));
  end if;

  if v_otp is null or v_otp !~ '^[0-9]{4,10}$' then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'error_bad_payload');
    return v_unavailable;
  end if;

  perform pg_advisory_xact_lock(hashtext('sms_otp:' || v_hash));
  v_decision := private.sms_otp_decision(v_hash);

  if v_decision = 'cooldown' then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'rejected_cooldown');
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Wait a minute before asking for another code.'));
  end if;

  if v_decision = 'daily_cap' then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'rejected_daily_cap');
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Too many codes today. Use email, or try tomorrow.'));
  end if;

  if v_decision = 'global_cap' then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'rejected_global_cap');
    perform private.sms_alert('global_cap', '300 texts sent in the last 24 hours: new SMS code requests are refused (people are sent to email).');
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 429,
      'message', 'Text codes are busy right now. Use your email instead, or try again later.'));
  end if;

  -- UniSMS (when its key is in Vault).
  select nullif(trim(decrypted_secret), '') into v_unisms_key from vault.decrypted_secrets where name = 'UNISMS_SECRET_KEY' limit 1;
  if v_unisms_key is not null then
    select nullif(trim(decrypted_secret), '') into v_sender from vault.decrypted_secrets where name = 'UNISMS_SENDER_ID' limit 1;
    if v_sender is null then
      insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'error_no_sender');
      perform private.sms_alert('no_sender', 'Someone asked for an SMS code but Vault has no UNISMS_SENDER_ID, so they were sent to email. Store the sender ID from the UniSMS dashboard.', interval '12 hours');
      return v_unavailable;
    end if;

    begin
      perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '1500');
      v_response := extensions.http((
        'POST',
        'https://unismsapi.com/api/sms',
        array[extensions.http_header('Authorization',
          'Basic ' || replace(encode(convert_to(v_unisms_key || ':', 'UTF8'), 'base64'), E'\n', ''))],
        'application/json',
        jsonb_build_object(
          'recipient', '+' || v_digits,
          'content', format('Moodeng Credit: your sign-in code is %s. Never share this code.', v_otp),
          'sender_id', v_sender)::text
      )::extensions.http_request);
    exception when others then
      -- Timed out or couldn't connect. A timeout may still have gone out, so count it toward limits.
      insert into private.sms_otp_sends (phone_hash, status, failure_reason, checked_at)
      values (v_hash, 'sent', 'unconfirmed: ' || left(sqlerrm, 80), now());
      return '{}'::jsonb;
    end;

    if v_response.status between 200 and 299 then
      insert into private.sms_otp_sends (phone_hash, status, checked_at) values (v_hash, 'sent', now());
      return '{}'::jsonb;
    end if;

    if v_response.status = 422 and v_response.content ~* 'smart|tnt|sun' then
      insert into private.sms_otp_sends (phone_hash, status, failure_reason, checked_at)
      values (v_hash, 'rejected_network', 'unisms: smart/tnt/sun', now());
      return jsonb_build_object('error', jsonb_build_object(
        'http_code', 400,
        'message', 'Text codes don''t reach Smart, TNT or Sun numbers yet. Use your email instead.'));
    end if;

    insert into private.sms_otp_sends (phone_hash, status, failure_reason, checked_at)
    values (v_hash, 'failed', 'unisms: http ' || v_response.status, now());
    perform private.sms_alert('send_failed', format('UniSMS refused a sign-in text (HTTP %s). Check the key, sender ID and credits in the UniSMS dashboard.', v_response.status));
    return v_unavailable;
  end if;

  -- Semaphore (unchanged).
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'SEMAPHORE_API_KEY' limit 1;
  if nullif(trim(v_api_key), '') is null then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'error_no_api_key');
    perform private.sms_alert('no_api_key', 'Vault secret SEMAPHORE_API_KEY is missing, so no texts are being sent.');
    return v_unavailable;
  end if;

  -- Semaphore delivers nothing without an approved sender name, so don't pretend a code is coming.
  select decrypted_secret into v_sender from vault.decrypted_secrets where name = 'SEMAPHORE_SENDER_NAME' limit 1;
  if nullif(trim(v_sender), '') is null then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'error_no_sender');
    perform private.sms_alert('no_sender', 'Someone asked for an SMS code but no approved Semaphore sender name is set, so they were sent to email. Once Semaphore approves MOODENG, store it in Vault as SEMAPHORE_SENDER_NAME.', interval '12 hours');
    return v_unavailable;
  end if;

  v_body := jsonb_build_object(
    'apikey', trim(v_api_key),
    'number', v_digits,
    'message', format('Your Moodeng code is %s. Don''t share it with anyone.', v_otp),
    'sendername', trim(v_sender));

  select net.http_post(
    url := 'https://api.semaphore.co/api/v4/priority',
    body := v_body,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  ) into v_request;

  insert into private.sms_otp_sends (phone_hash, status, net_request_id) values (v_hash, 'queued', v_request);
  return '{}'::jsonb;
end;
$$;

grant execute on function public.send_sms_semaphore(jsonb) to supabase_auth_admin;
revoke execute on function public.send_sms_semaphore(jsonb) from public, anon, authenticated;

comment on function public.send_sms_semaphore(jsonb) is
  'Supabase Auth Send SMS hook: PH numbers only, 60s cooldown, 5/day per number, 300/day overall, sends through UniSMS (Vault UNISMS_SECRET_KEY + UNISMS_SENDER_ID) when set, else Semaphore.';
