-- SMS test page (moodeng.app/sms-test?t=TOKEN): people the team sends the link to test whether Sprint SMS
-- texts actually reach their phone. They type their PH number + network, we text a 6-digit code through
-- Sprint only, and if they type it back they get one ₱50 Xoxo food link from public.voucher_codes on the
-- spot. "I didn't get it" is logged too (no reward: we can't verify it). Every outcome posts to Discord
-- #rewards with the network, the sender name they saw and Sprint's message id (for Sprint to look up).
--
-- No edge function: Sprint is called with pg_net using the vault SPRINT_SMS creds ({api_id, api_password}),
-- so the password never leaves the database. The link token sits in the vault as SMS_TEST_TOKEN.
--
-- Limits (so a shared link can't be farmed): token required; one reward per phone; 3 codes per phone,
-- 60 s apart; 6 codes per IP per day; 60 codes a day overall; 5 tries per code, valid 30 min; rewards stop
-- at telegram_bot_settings.sms_test_max_rewards (default 10) or when the ₱50 link stock runs out.

create table if not exists private.sms_tests (
  id               uuid primary key default gen_random_uuid(),
  phone            text not null check (phone ~ '^639[0-9]{9}$'),
  network          text not null check (network in ('globe', 'smart', 'tm', 'dito', 'gomo', 'not_sure')),
  tester_name      text check (char_length(tester_name) <= 60),
  ip               text,
  code             text not null,
  sprint_request   bigint,
  sprint_status    text,
  sprint_message_id text,
  status           text not null default 'sent' check (status in ('sent', 'arrived', 'not_received')),
  sender_seen      text check (char_length(sender_seen) <= 40),
  tries            integer not null default 0,
  reward_code_id   uuid references public.voucher_codes(id) on delete set null,
  reward_owed      boolean not null default false,
  created_at       timestamptz not null default now(),
  answered_at      timestamptz
);

create index if not exists sms_tests_phone_idx on private.sms_tests (phone, created_at desc);
create index if not exists sms_tests_created_idx on private.sms_tests (created_at desc);
create unique index if not exists sms_tests_one_reward_per_phone
  on private.sms_tests (phone) where reward_code_id is not null or reward_owed;

alter table private.sms_tests enable row level security;

insert into public.telegram_bot_settings (key, value, description)
values ('sms_test_max_rewards', '10', 'SMS test page: most ₱50 rewards it gives out in total (also stops when the ₱50 link stock is empty)')
on conflict (key) do nothing;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'SMS_TEST_TOKEN') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(6), 'hex'), 'SMS_TEST_TOKEN',
      'moodeng.app/sms-test?t=<this> — link token for the Sprint SMS test page');
  end if;
end $$;

-- ── helpers ─────────────────────────────────────────────────────────────────────────────────────────

create or replace function private.sms_test_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(p_token), '') = (select btrim(decrypted_secret) from vault.decrypted_secrets
                                               where name = 'SMS_TEST_TOKEN' limit 1), false);
$$;

-- 0917 123 4567 / +63 917… / 917… → 639171234567, else null.
create or replace function private.sms_test_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^639[0-9]{9}$' then d
    when d ~ '^09[0-9]{9}$' then '63' || substr(d, 2)
    when d ~ '^9[0-9]{9}$' then '63' || d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) x;
$$;

create or replace function private.sms_test_rewards_left()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, least(
    coalesce((select value::int from public.telegram_bot_settings where key = 'sms_test_max_rewards'), 10)
      - (select count(*)::int from private.sms_tests where reward_code_id is not null or reward_owed),
    (select count(*)::int from public.voucher_codes where amount_php = 50 and assigned_at is null)
  ));
$$;

-- Copy Sprint's reply (pg_net keeps responses ~6 h) onto the row.
create or replace function private.sms_test_read_sprint(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body jsonb;
begin
  select case when r.content ~ '^\s*\{' then r.content::jsonb end
    into v_body
  from private.sms_tests t
  join net._http_response r on r.id = t.sprint_request
  where t.id = p_id;
  if v_body is not null then
    update private.sms_tests
       set sprint_status = coalesce(v_body ->> 'status', sprint_status),
           sprint_message_id = coalesce(v_body ->> 'message_id', sprint_message_id)
     where id = p_id;
  end if;
exception
  when others then null;
end;
$$;

create or replace function private.sms_test_discord(p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := (select btrim(decrypted_secret) from vault.decrypted_secrets where name = 'DISCORD_REWARDS_WEBHOOK_URL' limit 1);
begin
  if nullif(v_url, '') is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('content', left(p_text, 1900), 'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb)),
    headers := jsonb_build_object('Content-Type', 'application/json'));
end;
$$;

create or replace function private.sms_test_summary(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select concat_ws(' · ',
    upper(t.network),
    '09' || substr(t.phone, 4, 2) || '•••' || right(t.phone, 4),
    nullif(t.tester_name, ''),
    case when t.sender_seen is not null then 'sender: ' || t.sender_seen end,
    'Sprint ' || coalesce(t.sprint_status, '?') || ' ' || coalesce(t.sprint_message_id, ''),
    case when t.answered_at is not null then extract(epoch from t.answered_at - t.created_at)::int || 's after send' end)
  from private.sms_tests t where t.id = p_id;
$$;

revoke all on function private.sms_test_token_ok(text) from public, anon, authenticated;
revoke all on function private.sms_test_phone(text) from public, anon, authenticated;
revoke all on function private.sms_test_rewards_left() from public, anon, authenticated;
revoke all on function private.sms_test_read_sprint(uuid) from public, anon, authenticated;
revoke all on function private.sms_test_discord(text) from public, anon, authenticated;
revoke all on function private.sms_test_summary(uuid) from public, anon, authenticated;

-- ── page calls ──────────────────────────────────────────────────────────────────────────────────────

-- Is the link good, and are rewards still open? {ok, open}
create or replace function public.sms_test_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.sms_test_token_ok(p_token) then
    return jsonb_build_object('ok', false, 'error', 'bad_link');
  end if;
  return jsonb_build_object('ok', true, 'open', private.sms_test_rewards_left() > 0);
end;
$$;

-- Text a code. {ok, test_id} or {ok:false, error: bad_link|bad_phone|bad_network|already_done|closed|wait|too_many}
create or replace function public.sms_test_send(p_token text, p_phone text, p_network text, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone   text := private.sms_test_phone(p_phone);
  v_network text := lower(btrim(coalesce(p_network, '')));
  v_ip      text;
  v_creds   jsonb;
  v_code    text;
  v_id      uuid;
  v_req     bigint;
begin
  if not private.sms_test_token_ok(p_token) then
    return jsonb_build_object('ok', false, 'error', 'bad_link');
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;
  if v_network not in ('globe', 'smart', 'tm', 'dito', 'gomo', 'not_sure') then
    return jsonb_build_object('ok', false, 'error', 'bad_network');
  end if;
  if exists (select 1 from private.sms_tests where phone = v_phone and (reward_code_id is not null or reward_owed)) then
    return jsonb_build_object('ok', false, 'error', 'already_done');
  end if;
  if private.sms_test_rewards_left() <= 0 then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  if exists (select 1 from private.sms_tests where phone = v_phone and created_at > now() - interval '60 seconds') then
    return jsonb_build_object('ok', false, 'error', 'wait');
  end if;

  begin
    v_ip := btrim(split_part(coalesce(
      current_setting('request.headers', true)::jsonb ->> 'cf-connecting-ip',
      current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1));
  exception
    when others then v_ip := null;
  end;

  if (select count(*) from private.sms_tests where phone = v_phone) >= 3
     or (nullif(v_ip, '') is not null
         and (select count(*) from private.sms_tests where ip = v_ip and created_at > now() - interval '1 day') >= 6)
     or (select count(*) from private.sms_tests where created_at > now() - interval '1 day') >= 60 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;

  select decrypted_secret::jsonb into v_creds from vault.decrypted_secrets where name = 'SPRINT_SMS' limit 1;
  if v_creds is null then
    raise exception 'SPRINT_SMS missing from vault';
  end if;

  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');

  insert into private.sms_tests (phone, network, tester_name, ip, code)
  values (v_phone, v_network, nullif(left(btrim(coalesce(p_name, '')), 60), ''), nullif(v_ip, ''), v_code)
  returning id into v_id;

  v_req := net.http_get(
    url := 'https://pxapi.sprintsmsservice.com/api/SendSms',
    params := jsonb_build_object(
      'api_id', v_creds ->> 'api_id',
      'api_password', v_creds ->> 'api_password',
      'sms_type', 'T',
      'encoding', 'T',
      'sender_id', 'Moodeng',
      'phonenumber', v_phone,
      'textmessage', 'Your Moodeng code is ' || v_code,
      'uid', v_id::text),
    timeout_milliseconds := 20000);

  update private.sms_tests set sprint_request = v_req where id = v_id;
  return jsonb_build_object('ok', true, 'test_id', v_id);
end;
$$;

-- They typed the code. {ok, link|owed} or {ok:false, error: bad_link|not_found|expired|wrong_code|too_many}
create or replace function public.sms_test_check(p_token text, p_test_id uuid, p_code text, p_sender text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t        private.sms_tests;
  v_link   public.voucher_codes;
  v_left   integer;
begin
  if not private.sms_test_token_ok(p_token) then
    return jsonb_build_object('ok', false, 'error', 'bad_link');
  end if;

  select * into t from private.sms_tests where id = p_test_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if t.status = 'arrived' then
    select * into v_link from public.voucher_codes where id = t.reward_code_id;
    return jsonb_build_object('ok', true, 'link', v_link.code, 'owed', t.reward_owed);
  end if;
  if t.tries >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;
  if t.created_at < now() - interval '30 minutes' then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  update private.sms_tests set tries = tries + 1 where id = t.id;
  if regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g') <> t.code then
    return jsonb_build_object('ok', false, 'error', 'wrong_code', 'tries_left', 4 - t.tries);
  end if;

  perform private.sms_test_read_sprint(t.id);

  -- Already rewarded on another test (two codes sent to the same phone): no second reward.
  if exists (select 1 from private.sms_tests where phone = t.phone and id <> t.id and (reward_code_id is not null or reward_owed)) then
    update private.sms_tests
       set status = 'arrived', answered_at = now(), sender_seen = nullif(left(btrim(coalesce(p_sender, '')), 40), '')
     where id = t.id;
    return jsonb_build_object('ok', true, 'already_rewarded', true);
  end if;

  if coalesce((select value::int from public.telegram_bot_settings where key = 'sms_test_max_rewards'), 10)
       > (select count(*) from private.sms_tests where reward_code_id is not null or reward_owed) then
    select * into v_link
      from public.voucher_codes
     where amount_php = 50 and assigned_at is null
     order by created_at
     limit 1
     for update skip locked;
    if found then
      update public.voucher_codes set assigned_at = now() where id = v_link.id;
    end if;
  end if;

  update private.sms_tests
     set status = 'arrived',
         answered_at = now(),
         sender_seen = nullif(left(btrim(coalesce(p_sender, '')), 40), ''),
         reward_code_id = v_link.id,
         reward_owed = (v_link.id is null)
   where id = t.id;

  v_left := (select count(*) from public.voucher_codes where amount_php = 50 and assigned_at is null);
  perform private.sms_test_discord(
    '📱 **SMS test (Sprint): ✅ ARRIVED** — ' || private.sms_test_summary(t.id) || E'\n'
    || case when v_link.id is not null
         then '₱50 food link given on the page (' || v_left || ' ₱50 links left)'
         else '⚠️ No ₱50 link left — we owe this person ₱50, send it by hand' end);

  return jsonb_build_object('ok', true, 'link', v_link.code, 'owed', v_link.id is null);
end;
$$;

-- "I didn't get it" after waiting. {ok}
create or replace function public.sms_test_not_received(p_token text, p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t private.sms_tests;
begin
  if not private.sms_test_token_ok(p_token) then
    return jsonb_build_object('ok', false, 'error', 'bad_link');
  end if;
  select * into t from private.sms_tests where id = p_test_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if t.status <> 'sent' then
    return jsonb_build_object('ok', true);
  end if;

  perform private.sms_test_read_sprint(t.id);
  update private.sms_tests set status = 'not_received', answered_at = now() where id = t.id;
  perform private.sms_test_discord('📱 **SMS test (Sprint): ❌ NOT RECEIVED** — ' || private.sms_test_summary(t.id));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.sms_test_status(text) from public;
revoke all on function public.sms_test_send(text, text, text, text) from public;
revoke all on function public.sms_test_check(text, uuid, text, text) from public;
revoke all on function public.sms_test_not_received(text, uuid) from public;
grant execute on function public.sms_test_status(text) to anon, authenticated;
grant execute on function public.sms_test_send(text, text, text, text) to anon, authenticated;
grant execute on function public.sms_test_check(text, uuid, text, text) to anon, authenticated;
grant execute on function public.sms_test_not_received(text, uuid) to anon, authenticated;
