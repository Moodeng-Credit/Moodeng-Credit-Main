-- Passwordless sign-in by SMS: Supabase Auth's "Send SMS" hook as a Postgres function that sends
-- the code through Semaphore (Philippine SMS gateway). No edge function: the project is at the
-- edge-function cap.
--
-- NOT ENABLED BY THIS MIGRATION. Before/after applying it:
--   1. Vault must hold SEMAPHORE_API_KEY (already stored).
--   2. Vault must hold SMS_PHONE_HASH_SALT. This migration creates it (random) when missing; if it
--      is ever deleted the hook refuses to send (fails closed) rather than hash with no salt.
--   3. Optional Vault secrets: SEMAPHORE_SENDER_NAME (once a sender name is approved; until then
--      texts come from Semaphore's default) and DISCORD_SMS_ALERTS_WEBHOOK_URL (where failure /
--      low-credit / daily-cap alerts go; without it alerts are only recorded in private.sms_alerts).
--   4. Auth > Providers > Phone: enable. Auth > Hooks > Send SMS: public.send_sms_semaphore.
--
-- Rules enforced here (on top of Supabase's own OTP rate limits):
--   - Philippine mobile numbers only (+639XXXXXXXXX). Anything else is refused with a message the
--     app shows as-is, and it moves the person to email.
--   - Per number: 60 seconds between texts, 5 texts in any 24 hours.
--   - Everyone together: 300 texts in any 24 hours (a runaway/abuse brake), then refuse + alert.
--   - Only texts Semaphore actually accepted (or that are still in flight) count toward limits.
--
-- Delivery tracking: pg_net is asynchronous, so the hook logs 'queued' with the pg_net request id
-- and a pg_cron job (every 2 minutes) reconciles it against net._http_response to 'sent' or
-- 'failed'. Semaphore answers validation errors with HTTP 200 + an error object, so 'sent' means
-- 2xx AND the success shape (a list with message_id), not just a 2xx.
--
-- Privacy: the log keeps a salted hash of the number, the outcome and the time. Never the number,
-- never the code. pg_net keeps request bodies (number, code, API key) in net.http_request_queue
-- until sent and responses (which echo the message) in net._http_response for ~6h: the cron job
-- deletes OUR Semaphore rows from both 15 minutes after the send. Log rows are kept 90 days.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists private.sms_otp_sends (
  id             bigint generated always as identity primary key,
  phone_hash     text not null,
  status         text not null check (status in (
                   'queued', 'sent', 'failed',
                   'rejected_non_ph', 'rejected_cooldown', 'rejected_daily_cap', 'rejected_global_cap',
                   'error_no_api_key', 'error_no_salt', 'error_bad_payload')),
  net_request_id bigint,
  -- Why a send failed, e.g. 'http 500', 'timeout', 'semaphore: number'. Never response values.
  failure_reason text,
  checked_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists sms_otp_sends_phone_recent_idx on private.sms_otp_sends (phone_hash, created_at desc);
create index if not exists sms_otp_sends_created_idx on private.sms_otp_sends (created_at);
create index if not exists sms_otp_sends_queued_idx on private.sms_otp_sends (net_request_id) where status = 'queued';

-- One row per alert kind per send, used to send at most one alert per kind per window.
create table if not exists private.sms_alerts (
  id         bigint generated always as identity primary key,
  kind       text not null,
  message    text not null,
  delivered  boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sms_alerts_kind_recent_idx on private.sms_alerts (kind, created_at desc);

-- Hourly Semaphore credit checks (GET /account), read back by the reconcile job.
create table if not exists private.semaphore_balance_checks (
  net_request_id bigint primary key,
  credit_balance numeric,
  checked_at     timestamptz,
  created_at     timestamptz not null default now()
);

alter table private.sms_otp_sends enable row level security;
alter table private.sms_alerts enable row level security;
alter table private.semaphore_balance_checks enable row level security;
revoke all on private.sms_otp_sends, private.sms_alerts, private.semaphore_balance_checks from public, anon, authenticated;

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

-- Salted hash of the number, or NULL when the salt is missing (callers fail closed).
create or replace function private.sms_phone_hash(p_digits text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_salt text;
begin
  select decrypted_secret into v_salt from vault.decrypted_secrets where name = 'SMS_PHONE_HASH_SALT' limit 1;
  if nullif(v_salt, '') is null then
    return null;
  end if;
  return encode(extensions.hmac(p_digits, v_salt, 'sha256'), 'hex');
end;
$$;

-- 'ok' | 'cooldown' | 'daily_cap' | 'global_cap'. Only accepted or in-flight texts count.
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
       where phone_hash = p_phone_hash and status in ('queued', 'sent') and created_at > p_now - interval '60 seconds'
    ) then 'cooldown'
    when (
      select count(*) from private.sms_otp_sends
       where phone_hash = p_phone_hash and status in ('queued', 'sent') and created_at > p_now - interval '24 hours'
    ) >= 5 then 'daily_cap'
    when (
      select count(*) from private.sms_otp_sends
       where status in ('queued', 'sent') and created_at > p_now - interval '24 hours'
    ) >= 300 then 'global_cap'
    else 'ok'
  end;
$$;

-- Which number gets the text. The hook payload has no SMS type, so user.new_phone (a pending,
-- unconfirmed phone change) must NOT win by default: a stale change would send login codes to a
-- number nobody verified. new_phone is used only when there is no confirmed phone, or when the
-- change was started in the last 10 minutes (a resend of an in-progress change). Otherwise phone.
create or replace function private.sms_otp_target_digits(event jsonb, p_now timestamptz default now())
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_phone     text := regexp_replace(coalesce(event -> 'user' ->> 'phone', ''), '\D', '', 'g');
  v_new_phone text := regexp_replace(coalesce(event -> 'user' ->> 'new_phone', ''), '\D', '', 'g');
  v_sent_at   timestamptz;
begin
  if v_new_phone = '' then
    return v_phone;
  end if;
  if v_phone = '' then
    return v_new_phone;
  end if;
  begin
    v_sent_at := nullif(event -> 'user' ->> 'phone_change_sent_at', '')::timestamptz;
  exception when others then
    v_sent_at := null;
  end;
  if v_sent_at is not null and v_sent_at > p_now - interval '10 minutes' and v_sent_at <= p_now + interval '1 minute' then
    return v_new_phone;
  end if;
  return v_phone;
end;
$$;

-- Semaphore success = a JSON list of message objects with message_id (status not failed).
create or replace function private.semaphore_send_ok(p_status integer, p_timed_out boolean, p_error text, p_content text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_json jsonb;
begin
  if p_status is null or p_status not between 200 and 299 or coalesce(p_timed_out, false) or p_error is not null then
    return false;
  end if;
  begin
    v_json := p_content::jsonb;
  exception when others then
    return false;
  end;
  return jsonb_typeof(v_json) = 'array'
     and jsonb_array_length(v_json) > 0
     and (v_json -> 0) ? 'message_id'
     and lower(coalesce(v_json -> 0 ->> 'status', '')) not in ('failed', 'refunded');
end;
$$;

-- A short, value-free reason for a failed send (Semaphore error objects are keyed by field).
create or replace function private.semaphore_failure_reason(p_status integer, p_timed_out boolean, p_error text, p_content text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_json jsonb;
begin
  if coalesce(p_timed_out, false) then return 'timeout'; end if;
  if p_error is not null then return 'network: ' || left(p_error, 120); end if;
  if p_status is null or p_status not between 200 and 299 then return 'http ' || coalesce(p_status::text, '?'); end if;
  begin
    v_json := p_content::jsonb;
  exception when others then
    return 'semaphore: unreadable response';
  end;
  if jsonb_typeof(v_json) = 'object' then
    return 'semaphore: ' || coalesce((select string_agg(k, ',' order by k) from jsonb_object_keys(v_json) as k), 'error');
  end if;
  if jsonb_typeof(v_json) = 'array' and jsonb_array_length(v_json) > 0 then
    return 'semaphore: status ' || coalesce(v_json -> 0 ->> 'status', '?');
  end if;
  return 'semaphore: unexpected response';
end;
$$;

-- credit_balance from a GET /account response, or NULL when it isn't readable.
create or replace function private.semaphore_credit_balance(p_status integer, p_content text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_status is null or p_status not between 200 and 299 then return null; end if;
  return nullif(p_content::jsonb ->> 'credit_balance', '')::numeric;
exception when others then
  return null;
end;
$$;

-- Records an alert and posts it to Discord, at most once per kind per p_window.
-- Webhook: Vault DISCORD_SMS_ALERTS_WEBHOOK_URL. None set = recorded only (delivered = false).
create or replace function private.sms_alert(p_kind text, p_message text, p_window interval default interval '1 hour')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook text;
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
  end if;
  insert into private.sms_alerts (kind, message, delivered) values (p_kind, p_message, nullif(trim(v_webhook), '') is not null);
end;
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
  v_unavailable constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 500,
    'message', 'Text codes are not available right now. Use your email instead.'));
begin
  v_hash := private.sms_phone_hash(v_digits);
  if v_hash is null then
    -- No salt: refuse rather than log an unsalted (reversible) hash.
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

  -- Two requests for the same number at once must not both slip past the cooldown. (The overall
  -- 300/day brake is not locked: a burst across many numbers can overshoot it by a few.)
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
    -- Best effort: if Auth rolls this transaction back, the reconcile job sends the alert instead.
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

  -- Semaphore is plain ASCII only (no unicode). It accepts a JSON body (checked 2026-10-15: a JSON
  -- POST was validated field by field, and the same request without apikey was refused for it).
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

-- ---------------------------------------------------------------------------
-- 4. Background jobs (pg_cron)
-- ---------------------------------------------------------------------------

-- Every 2 minutes: queued -> sent/failed, alerts, credit check results, purge of pg_net rows that
-- hold codes/the API key, 90-day log cleanup.
create or replace function private.sms_otp_reconcile(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sent      integer := 0;
  v_failed    integer := 0;
  v_reasons   text;
  v_balance   numeric;
  v_purged    integer := 0;
begin
  -- a. Delivery results.
  with done as (
    update private.sms_otp_sends s
       set status = case when private.semaphore_send_ok(r.status_code, r.timed_out, r.error_msg, r.content) then 'sent' else 'failed' end,
           failure_reason = case when private.semaphore_send_ok(r.status_code, r.timed_out, r.error_msg, r.content) then null
                                 else private.semaphore_failure_reason(r.status_code, r.timed_out, r.error_msg, r.content) end,
           checked_at = p_now
      from net._http_response r
     where s.status = 'queued' and r.id = s.net_request_id
    returning s.status, s.failure_reason
  )
  select count(*) filter (where status = 'sent'),
         count(*) filter (where status = 'failed'),
         string_agg(distinct failure_reason, '; ')
    into v_sent, v_failed, v_reasons
    from done;

  -- Still no response 15 minutes on (pg_net worker down, or response gone): not sent.
  with stuck as (
    update private.sms_otp_sends
       set status = 'failed', failure_reason = 'no response within 15 minutes', checked_at = p_now
     where status = 'queued' and created_at < p_now - interval '15 minutes'
    returning 1
  )
  select v_failed + count(*), case when count(*) > 0 then concat_ws('; ', v_reasons, 'no response within 15 minutes') else v_reasons end
    into v_failed, v_reasons
    from stuck;

  if v_failed > 0 then
    perform private.sms_alert('send_failed', format('%s text(s) failed in the last check (%s). Check credits / sender name in Semaphore.', v_failed, coalesce(v_reasons, 'unknown')));
  end if;

  -- b. The daily brake (also alerted here in case Auth rolled back the hook's own alert).
  if (select count(*) from private.sms_otp_sends where status in ('queued', 'sent') and created_at > p_now - interval '24 hours') >= 300 then
    perform private.sms_alert('global_cap', '300 texts sent in the last 24 hours: new SMS code requests are refused (people are sent to email).');
  end if;

  -- c. Credit balance results (from sms_request_semaphore_balance).
  update private.semaphore_balance_checks b
     set credit_balance = private.semaphore_credit_balance(r.status_code, r.content),
         checked_at = p_now
    from net._http_response r
   where b.checked_at is null and r.id = b.net_request_id;

  select credit_balance into v_balance
    from private.semaphore_balance_checks
   where checked_at = p_now and credit_balance is not null
   order by net_request_id desc limit 1;
  if v_balance is not null and v_balance < 200 then
    perform private.sms_alert('low_credit', format('Only %s Semaphore credits left (about %s texts at 2 credits each). Top up.', v_balance, floor(v_balance / 2)), interval '12 hours');
  end if;

  -- d. Purge our pg_net rows 15 minutes on: requests hold the API key + live code, responses echo the message.
  with ours as (
    select net_request_id as id from private.sms_otp_sends
     where net_request_id is not null and created_at < p_now - interval '15 minutes' and created_at > p_now - interval '2 days'
    union all
    select net_request_id from private.semaphore_balance_checks
     where created_at < p_now - interval '15 minutes' and created_at > p_now - interval '2 days'
  ), del_resp as (
    delete from net._http_response r using ours where r.id = ours.id returning 1
  ), del_queue as (
    delete from net.http_request_queue q using ours where q.id = ours.id returning 1
  )
  select (select count(*) from del_resp) + (select count(*) from del_queue) into v_purged;

  -- e. Retention.
  delete from private.sms_otp_sends where created_at < p_now - interval '90 days';
  delete from private.sms_alerts where created_at < p_now - interval '90 days';
  delete from private.semaphore_balance_checks where created_at < p_now - interval '90 days';

  return jsonb_build_object('sent', v_sent, 'failed', v_failed, 'purged', v_purged);
end;
$$;

-- Hourly: ask Semaphore for the credit balance (read back by sms_otp_reconcile).
create or replace function private.sms_request_semaphore_balance()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_api_key text;
  v_request bigint;
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'SEMAPHORE_API_KEY' limit 1;
  if nullif(trim(v_api_key), '') is null then
    return;
  end if;
  select net.http_get(
    url := 'https://api.semaphore.co/api/v4/account',
    params := jsonb_build_object('apikey', trim(v_api_key)),
    timeout_milliseconds := 10000
  ) into v_request;
  insert into private.semaphore_balance_checks (net_request_id) values (v_request);
end;
$$;

do $$
begin
  perform cron.unschedule('sms-otp-reconcile-2min');
exception when others then null;
end $$;
select cron.schedule('sms-otp-reconcile-2min', '*/2 * * * *', $$ select private.sms_otp_reconcile(); $$);

do $$
begin
  perform cron.unschedule('sms-semaphore-balance-hourly');
exception when others then null;
end $$;
select cron.schedule('sms-semaphore-balance-hourly', '41 * * * *', $$ select private.sms_request_semaphore_balance(); $$);

-- ---------------------------------------------------------------------------
-- 5. Grants: only Supabase Auth may call the hook; nothing is reachable through the Data API.
-- ---------------------------------------------------------------------------
grant usage on schema public to supabase_auth_admin;
grant execute on function public.send_sms_semaphore(jsonb) to supabase_auth_admin;
revoke execute on function public.send_sms_semaphore(jsonb) from public, anon, authenticated;
revoke execute on function private.sms_phone_hash(text) from public, anon, authenticated;
revoke execute on function private.sms_otp_decision(text, timestamptz) from public, anon, authenticated;
revoke execute on function private.sms_otp_target_digits(jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function private.semaphore_send_ok(integer, boolean, text, text) from public, anon, authenticated;
revoke execute on function private.semaphore_failure_reason(integer, boolean, text, text) from public, anon, authenticated;
revoke execute on function private.semaphore_credit_balance(integer, text) from public, anon, authenticated;
revoke execute on function private.sms_alert(text, text, interval) from public, anon, authenticated;
revoke execute on function private.sms_otp_reconcile(timestamptz) from public, anon, authenticated;
revoke execute on function private.sms_request_semaphore_balance() from public, anon, authenticated;

comment on function public.send_sms_semaphore(jsonb) is
  'Supabase Auth Send SMS hook: PH numbers only, 60s cooldown, 5/day per number, 300/day overall, sends through Semaphore (Vault SEMAPHORE_API_KEY).';
