-- Behaviour tests for migration 20261015180000_send_sms_semaphore_hook.sql (Send SMS hook).
--
-- Run against a THROWAWAY Postgres database only (never production). Part 1 creates minimal
-- stand-ins for the Supabase pieces the migration needs (vault, pg_net, pgcrypto's hmac, roles),
-- then apply the migration yourself:
--
--   createdb smstest
--   psql -d smstest -f supabase/tests/send_sms_semaphore_hook.test.sql            -- part 1 creates stubs
--   psql -d smstest -f supabase/migrations/20261015180000_send_sms_semaphore_hook.sql
--   psql -d smstest -v run_tests=1 -f supabase/tests/send_sms_semaphore_hook.test.sql
--
-- Expected final line: "15/15 passed".

\if :{?run_tests}
\set ON_ERROR_STOP 1
create temp table results (name text, ok boolean, detail text);

create or replace function pg_temp.event(p_phone text, p_otp text default '12345678', p_new_phone text default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'user', jsonb_build_object('id', '00000000-0000-0000-0000-000000000001', 'phone', p_phone, 'new_phone', p_new_phone),
    'sms', jsonb_build_object('otp', p_otp));
$$;

-- Pretend every text so far was sent `p_ago` earlier (moves the clock forward for the limits).
create or replace function pg_temp.age_sends(p_ago interval) returns void language sql as $$
  update private.sms_otp_sends set created_at = created_at - p_ago;
$$;

-- 1. Non-PH numbers are refused and nothing is sent.
insert into results
select 'non-PH number refused with the email message',
       r -> 'error' ->> 'message' = 'SMS codes work for Philippine numbers only. Use your email instead.'
         and (r -> 'error' ->> 'http_code')::int = 400,
       r::text
  from (select public.send_sms_semaphore(pg_temp.event('971501234567')) r) x;
insert into results select 'Indonesian number refused', (public.send_sms_semaphore(pg_temp.event('6281234567890')) ? 'error'), null;
insert into results select 'PH landline refused', (public.send_sms_semaphore(pg_temp.event('6328123456')) ? 'error'), null;
insert into results select 'nothing sent for refused numbers', (select count(*) = 0 from net.calls), null;

-- 2. A PH mobile number is sent through Semaphore's priority route.
insert into results
select 'PH number accepted', public.send_sms_semaphore(pg_temp.event('639171234567')) = '{}'::jsonb, null;
insert into results
select 'Semaphore request: number, ASCII message with the code, key from Vault, no sendername',
       c.url = 'https://api.semaphore.co/api/v4/priority'
         and c.body ->> 'number' = '639171234567'
         and c.body ->> 'message' = 'Your Moodeng code is 12345678. Don''t share it with anyone.'
         and c.body ->> 'apikey' = 'test-semaphore-key'
         and not (c.body ? 'sendername'),
       c.body::text
  from net.calls c order by c.id desc limit 1;

-- 3. 60-second cooldown per number.
insert into results
select 'second text within 60s is refused',
       r -> 'error' ->> 'message' = 'Wait a minute before asking for another code.' and (r -> 'error' ->> 'http_code')::int = 429,
       r::text
  from (select public.send_sms_semaphore(pg_temp.event('+639171234567')) r) x;
select pg_temp.age_sends('30 seconds');
insert into results
select 'still refused 30s later', public.send_sms_semaphore(pg_temp.event('639171234567')) ? 'error', null;
insert into results
select 'another number is not slowed down', public.send_sms_semaphore(pg_temp.event('639181112222')) = '{}'::jsonb, null;

-- 4. Daily cap: 5 texts per number in 24 hours.
select pg_temp.age_sends('2 minutes');
select public.send_sms_semaphore(pg_temp.event('639171234567'));  -- 2nd
select pg_temp.age_sends('2 minutes');
select public.send_sms_semaphore(pg_temp.event('639171234567'));  -- 3rd
select pg_temp.age_sends('2 minutes');
select public.send_sms_semaphore(pg_temp.event('639171234567'));  -- 4th
select pg_temp.age_sends('2 minutes');
insert into results
select '5th text in a day is sent', public.send_sms_semaphore(pg_temp.event('639171234567')) = '{}'::jsonb, null;
select pg_temp.age_sends('2 minutes');
insert into results
select '6th text in a day is refused',
       public.send_sms_semaphore(pg_temp.event('639171234567')) -> 'error' ->> 'message' like 'Too many codes for this number today.%',
       null;
select pg_temp.age_sends('25 hours');
insert into results
select 'cap resets after 24 hours', public.send_sms_semaphore(pg_temp.event('639171234567')) = '{}'::jsonb, null;

-- 5. The log never holds the number or the code.
insert into results
select 'log has no phone number or code',
       not exists (select 1 from private.sms_otp_sends s where s::text like '%9171234567%' or s::text like '%12345678%'),
       null;

-- 6. Phone change: the code goes to the new number; sender name from Vault when set.
insert into vault.secrets (name, secret) values ('SEMAPHORE_SENDER_NAME', 'Moodeng');
select public.send_sms_semaphore(pg_temp.event('', '87654321', '639285556666'));
insert into results
select 'phone change texts new_phone, with the Vault sender name',
       c.body ->> 'number' = '639285556666' and c.body ->> 'sendername' = 'Moodeng',
       c.body::text
  from net.calls c order by c.id desc limit 1;

-- 7. Only Supabase Auth can call the hook.
insert into results
select 'anon/authenticated cannot call the hook; supabase_auth_admin can',
       not has_function_privilege('anon', 'public.send_sms_semaphore(jsonb)', 'execute')
         and not has_function_privilege('authenticated', 'public.send_sms_semaphore(jsonb)', 'execute')
         and has_function_privilege('supabase_auth_admin', 'public.send_sms_semaphore(jsonb)', 'execute'),
       null;

select name, ok, detail from results where not ok;
select count(*) filter (where ok) || '/' || count(*) || ' passed' as summary from results;

\else
-- Part 1: stand-ins for Supabase's vault, pg_net, pgcrypto and roles.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin; end if;
end $$;

create schema if not exists vault;
create table if not exists vault.secrets (name text primary key, secret text, description text);
create or replace view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
create or replace function vault.create_secret(new_secret text, new_name text, new_description text default '')
returns uuid language sql as $$
  insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description);
  select '00000000-0000-0000-0000-000000000000'::uuid;
$$;
insert into vault.secrets (name, secret) values ('SEMAPHORE_API_KEY', 'test-semaphore-key') on conflict do nothing;

create schema if not exists extensions;
create or replace function extensions.gen_random_bytes(n int) returns bytea language sql as $$
  select decode(substr(repeat(md5(random()::text), 4), 1, n * 2), 'hex');
$$;
create or replace function extensions.hmac(data text, key text, type text) returns bytea language sql as $$
  select sha256(convert_to(key || data, 'UTF8'));
$$;

create schema if not exists net;
create table if not exists net.calls (id bigserial primary key, url text, body jsonb, headers jsonb);
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as $$
  insert into net.calls (url, body, headers) values (url, body, headers) returning id;
$$;
\endif
