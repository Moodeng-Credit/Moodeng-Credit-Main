-- SMS codes: don't send until Semaphore has approved a sender name.
--
-- Without an approved sender name Semaphore answers every real send with HTTP 500 and delivers
-- nothing, so people waited for a code that never came (16 Oct 2026). Now, while Vault has no
-- SEMAPHORE_SENDER_NAME, the hook refuses straight away with "Use your email instead" and alerts
-- the team. Once Semaphore approves MOODENG (or MOOCREDIT), store it in Vault as
-- SEMAPHORE_SENDER_NAME and texts start going out again; no code change needed.

alter table private.sms_otp_sends drop constraint if exists sms_otp_sends_status_check;
alter table private.sms_otp_sends add constraint sms_otp_sends_status_check check (status in (
  'queued', 'sent', 'failed',
  'rejected_non_ph', 'rejected_cooldown', 'rejected_daily_cap', 'rejected_global_cap',
  'error_no_api_key', 'error_no_salt', 'error_bad_payload', 'error_no_sender'));

create or replace function public.send_sms_semaphore(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits   text := private.sms_otp_target_digits(event);
  v_otp      text := event -> 'sms' ->> 'otp';
  v_hash     text;
  v_decision text;
  v_api_key  text;
  v_sender   text;
  v_body     jsonb;
  v_request  bigint;
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
