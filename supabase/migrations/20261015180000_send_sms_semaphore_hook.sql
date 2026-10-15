-- Passwordless sign-in by SMS: Supabase Auth's "Send SMS" hook as a Postgres function that sends
-- the code through Semaphore (Philippine SMS gateway). No edge function: the project is at the
-- edge-function cap.
--
-- NOT ENABLED BY THIS MIGRATION. After applying it:
--   1. Vault must hold SEMAPHORE_API_KEY (already stored). Optional: SEMAPHORE_SENDER_NAME once a
--      sender name is approved in Semaphore; until then texts come from Semaphore's default.
--   2. Auth > Providers > Phone: enable (any SMS provider placeholder; the hook replaces it).
--   3. Auth > Hooks > Send SMS: Postgres function public.send_sms_semaphore.
--
-- Rules enforced here (on top of Supabase's own OTP rate limits):
--   - Philippine mobile numbers only (+639XXXXXXXXX). Anything else is refused with a message the
--     app shows as-is, and it moves the person to email.
--   - Per-number cooldown: 60 seconds between texts.
--   - Per-number daily cap: 5 texts in any 24 hours.
-- Every attempt is logged in private.sms_otp_sends with a salted hash of the number, the outcome
-- and the time. Never the number, never the code.
--
-- Note: pg_net keeps the Semaphore request/response (which contains the message text) in its own
-- net.* tables for ~6 hours. Only the database owner/service role can read those.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- 1. Send log
-- ---------------------------------------------------------------------------
create table if not exists private.sms_otp_sends (
  id             bigint generated always as identity primary key,
  phone_hash     text not null,
  status         text not null check (status in ('queued', 'rejected_non_ph', 'rejected_cooldown', 'rejected_daily_cap', 'error_no_api_key', 'error_bad_payload')),
  net_request_id bigint,
  created_at     timestamptz not null default now()
);
create index if not exists sms_otp_sends_phone_recent_idx on private.sms_otp_sends (phone_hash, created_at desc);

alter table private.sms_otp_sends enable row level security;
revoke all on private.sms_otp_sends from public, anon, authenticated;

-- Salt for the number hash, generated once and kept in Vault (a bare sha256 of a PH mobile number
-- is trivially reversible: there are only ~10^9 of them).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'SMS_PHONE_HASH_SALT') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'SMS_PHONE_HASH_SALT', 'Salt for hashing phone numbers in private.sms_otp_sends');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------------
create or replace function private.sms_phone_hash(p_digits text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.hmac(
      p_digits,
      coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'SMS_PHONE_HASH_SALT' limit 1), ''),
      'sha256'
    ),
    'hex'
  );
$$;

-- 'ok' | 'cooldown' | 'daily_cap' for a number (by hash). Only texts actually sent count.
create or replace function private.sms_otp_decision(p_phone_hash text, p_now timestamptz default now())
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from private.sms_otp_sends
       where phone_hash = p_phone_hash and status = 'queued' and created_at > p_now - interval '60 seconds'
    ) then 'cooldown'
    when (
      select count(*) from private.sms_otp_sends
       where phone_hash = p_phone_hash and status = 'queued' and created_at > p_now - interval '24 hours'
    ) >= 5 then 'daily_cap'
    else 'ok'
  end;
$$;

-- Supabase stores phones without "+"; a phone change sends the code to user.new_phone.
create or replace function private.sms_otp_target_digits(event jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    coalesce(nullif(event -> 'user' ->> 'new_phone', ''), event -> 'user' ->> 'phone', ''),
    '\D', '', 'g'
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. The hook
-- ---------------------------------------------------------------------------
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
begin
  v_hash := private.sms_phone_hash(v_digits);

  if v_digits !~ '^639[0-9]{9}$' then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'rejected_non_ph');
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 400,
      'message', 'SMS codes work for Philippine numbers only. Use your email instead.'));
  end if;

  if v_otp is null or v_otp !~ '^[0-9]{4,10}$' then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'error_bad_payload');
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 500,
      'message', 'Text codes are not available right now. Use your email instead.'));
  end if;

  -- Two requests for the same number at once must not both slip past the cooldown.
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
      'message', 'Too many codes for this number today. Use your email instead, or try again tomorrow.'));
  end if;

  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'SEMAPHORE_API_KEY' limit 1;
  if nullif(trim(v_api_key), '') is null then
    insert into private.sms_otp_sends (phone_hash, status) values (v_hash, 'error_no_api_key');
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 500,
      'message', 'Text codes are not available right now. Use your email instead.'));
  end if;

  -- Semaphore is plain ASCII only (no unicode).
  v_body := jsonb_build_object(
    'apikey', trim(v_api_key),
    'number', v_digits,
    'message', format('Your Moodeng code is %s. Don''t share it with anyone.', v_otp));

  -- Without a registered sender name Semaphore uses its default ("SEMAPHORE").
  select decrypted_secret into v_sender from vault.decrypted_secrets where name = 'SEMAPHORE_SENDER_NAME' limit 1;
  if nullif(trim(v_sender), '') is not null then
    v_body := v_body || jsonb_build_object('sendername', trim(v_sender));
  end if;

  -- Priority route: skips Semaphore's normal queue. (The /otp route would generate or append its
  -- own code unless its `code` parameter is used exactly right; we already have Supabase's code.)
  -- pg_net is asynchronous: the text goes out after this transaction commits.
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

-- Only Supabase Auth may call the hook; nothing is reachable through the Data API.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.send_sms_semaphore(jsonb) to supabase_auth_admin;
revoke execute on function public.send_sms_semaphore(jsonb) from public, anon, authenticated;
revoke execute on function private.sms_phone_hash(text) from public, anon, authenticated;
revoke execute on function private.sms_otp_decision(text, timestamptz) from public, anon, authenticated;
revoke execute on function private.sms_otp_target_digits(jsonb) from public, anon, authenticated;

comment on function public.send_sms_semaphore(jsonb) is
  'Supabase Auth Send SMS hook: PH numbers only, 60s cooldown, 5/day cap, sends through Semaphore (Vault SEMAPHORE_API_KEY).';
