-- Admin → More → Test lab: send real Semaphore texts by hand and see what Semaphore says back.
--
-- No edge function (the project is at the function cap): the RPC posts to Semaphore through pg_net
-- with the Vault key, exactly like the Send SMS hook (20261016140000_sms_require_sender_name.sql),
-- and the page polls admin_semaphore_result() for the reply. Only requests made here can be read
-- back, so this can't be used to read other pg_net responses.
--
--   admin_semaphore_call('send' | 'priority' | 'otp', number, message, sender?) → request id
--   admin_semaphore_call('account' | 'sendernames' | 'messages')                → request id
--   admin_semaphore_call('message', p_message_id => 123)                       → request id
--   admin_semaphore_result(request id) → { done, http_status, body, error }
--   admin_sms_hook_log() → the last 30 sign-in code attempts (status only, no phone numbers)

create table if not exists private.semaphore_test_requests (
  net_request_id bigint primary key,
  kind           text not null,
  created_by     uuid,
  created_at     timestamptz not null default now()
);
create index if not exists semaphore_test_requests_recent_idx on private.semaphore_test_requests (created_at);
alter table private.semaphore_test_requests enable row level security;
revoke all on private.semaphore_test_requests from public, anon, authenticated;

create or replace function public.admin_semaphore_call(
  p_kind       text,
  p_number     text default null,
  p_message    text default null,
  p_sender     text default null,
  p_message_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind    text := lower(trim(coalesce(p_kind, '')));
  v_api_key text;
  v_sender  text;
  v_digits  text;
  v_message text := trim(coalesce(p_message, ''));
  v_body    jsonb;
  v_request bigint;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;

  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'SEMAPHORE_API_KEY' limit 1;
  if nullif(trim(v_api_key), '') is null then
    raise exception 'Vault secret SEMAPHORE_API_KEY is missing.';
  end if;
  v_api_key := trim(v_api_key);

  if v_kind in ('send', 'priority', 'otp') then
    -- Texts cost credits: at most 30 test texts a day across all admins.
    if (select count(*) from private.semaphore_test_requests
         where kind in ('send', 'priority', 'otp') and created_at > now() - interval '24 hours') >= 30 then
      raise exception 'Test limit reached: 30 texts in the last 24 hours.';
    end if;

    -- 09171234567, 9171234567, +63 917 123 4567 → 639171234567
    v_digits := regexp_replace(coalesce(p_number, ''), '[^0-9]', '', 'g');
    v_digits := case
      when v_digits ~ '^639[0-9]{9}$' then v_digits
      when v_digits ~ '^09[0-9]{9}$' then '63' || substr(v_digits, 2)
      when v_digits ~ '^9[0-9]{9}$' then '63' || v_digits
      else null
    end;
    if v_digits is null then
      raise exception 'Semaphore only texts Philippine mobiles: use 09XX XXX XXXX or +63 9XX XXX XXXX.';
    end if;

    if v_message = '' or length(v_message) > 480 then
      raise exception 'Type a message (max 480 characters).';
    end if;
    -- Semaphore silently drops messages starting with "TEST" (its API docs say so).
    if v_message ~* '^test' then
      raise exception 'Semaphore silently drops messages that start with "TEST". Start with something else.';
    end if;

    v_sender := nullif(trim(coalesce(p_sender, '')), '');
    if v_sender is null then
      select nullif(trim(decrypted_secret), '') into v_sender
        from vault.decrypted_secrets where name = 'SEMAPHORE_SENDER_NAME' limit 1;
    end if;

    v_body := jsonb_build_object('apikey', v_api_key, 'number', v_digits, 'message', v_message);
    -- No sender → Semaphore uses the account's default sender name.
    if v_sender is not null then
      v_body := v_body || jsonb_build_object('sendername', v_sender);
    end if;

    select net.http_post(
      url := 'https://api.semaphore.co/api/v4/' || case v_kind when 'send' then 'messages' else v_kind end,
      body := v_body,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      timeout_milliseconds := 15000
    ) into v_request;

  elsif v_kind in ('account', 'sendernames', 'messages') then
    select net.http_get(
      url := 'https://api.semaphore.co/api/v4/' || case v_kind
        when 'account' then 'account'
        when 'sendernames' then 'account/sendernames'
        else 'messages' end,
      params := jsonb_build_object('apikey', v_api_key, 'limit', '20'),
      timeout_milliseconds := 15000
    ) into v_request;

  elsif v_kind = 'message' then
    if p_message_id is null then
      raise exception 'Pass p_message_id.';
    end if;
    select net.http_get(
      url := 'https://api.semaphore.co/api/v4/messages/' || p_message_id::text,
      params := jsonb_build_object('apikey', v_api_key),
      timeout_milliseconds := 15000
    ) into v_request;

  else
    raise exception 'Unknown kind %', v_kind;
  end if;

  insert into private.semaphore_test_requests (net_request_id, kind, created_by) values (v_request, v_kind, auth.uid());
  return v_request;
end;
$$;

create or replace function public.admin_semaphore_result(p_request_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resp record;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if not exists (select 1 from private.semaphore_test_requests where net_request_id = p_request_id) then
    raise exception 'Unknown test request';
  end if;

  select status_code, content, timed_out, error_msg into v_resp
    from net._http_response where id = p_request_id;
  if not found then
    return jsonb_build_object('done', false);
  end if;

  return jsonb_build_object(
    'done', true,
    'http_status', v_resp.status_code,
    'error', coalesce(v_resp.error_msg, case when v_resp.timed_out then 'timed out' end),
    'body', case
      when v_resp.content is null then null
      when left(ltrim(v_resp.content), 1) in ('{', '[') then v_resp.content::jsonb
      else to_jsonb(left(v_resp.content, 2000))
    end);
exception when invalid_text_representation then
  return jsonb_build_object('done', true, 'http_status', v_resp.status_code, 'body', to_jsonb(left(v_resp.content, 2000)));
end;
$$;

create or replace function public.admin_sms_hook_log()
returns table (status text, failure_reason text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select s.status, s.failure_reason, s.created_at
      from private.sms_otp_sends s
     order by s.created_at desc
     limit 30;
end;
$$;

revoke all on function public.admin_semaphore_call(text, text, text, text, bigint) from public, anon;
revoke all on function public.admin_semaphore_result(bigint) from public, anon;
revoke all on function public.admin_sms_hook_log() from public, anon;
grant execute on function public.admin_semaphore_call(text, text, text, text, bigint) to authenticated;
grant execute on function public.admin_semaphore_result(bigint) to authenticated;
grant execute on function public.admin_sms_hook_log() to authenticated;
