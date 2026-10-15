-- Behaviour tests for migration 20261015180000_send_sms_semaphore_hook.sql (Send SMS hook,
-- delivery reconcile, alerts, purge).
--
-- Run against a THROWAWAY Postgres database only (never production). Part 1 creates minimal
-- stand-ins for the Supabase pieces the migration needs (vault, pg_net, pg_cron, pgcrypto's hmac,
-- roles), then apply the migration yourself:
--
--   createdb smstest
--   psql -d smstest -f supabase/tests/send_sms_semaphore_hook.test.sql            -- part 1 creates stubs
--   psql -d smstest -f supabase/migrations/20261015180000_send_sms_semaphore_hook.sql
--   psql -d smstest -v run_tests=1 -f supabase/tests/send_sms_semaphore_hook.test.sql
--
-- Expected final line: "46/46 passed".

\if :{?run_tests}
\set ON_ERROR_STOP 1
create temp table results (name text, ok boolean, detail text);

create or replace function pg_temp.event(p_phone text, p_otp text default '12345678', p_new_phone text default null, p_change_sent_at timestamptz default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'user', jsonb_build_object('id', '00000000-0000-0000-0000-000000000001', 'phone', p_phone, 'new_phone', p_new_phone,
                               'phone_change_sent_at', p_change_sent_at),
    'sms', jsonb_build_object('otp', p_otp));
$$;

-- Pretend every text so far was sent `p_ago` earlier (moves the clock forward for the limits).
create or replace function pg_temp.age_sends(p_ago interval) returns void language sql as $$
  update private.sms_otp_sends set created_at = created_at - p_ago;
$$;

-- Fake pg_net delivering a response for a request id.
create or replace function pg_temp.respond(p_id bigint, p_status int, p_content text, p_timed_out boolean default false, p_error text default null)
returns void language sql as $$
  insert into net._http_response (id, status_code, content, timed_out, error_msg, created) values (p_id, p_status, p_content, p_timed_out, p_error, now());
$$;

create or replace function pg_temp.last_send_id() returns bigint language sql as $$
  select net_request_id from private.sms_otp_sends where net_request_id is not null order by id desc limit 1;
$$;

-- ── 1. Non-PH numbers are refused and nothing is sent ─────────────────────────
insert into results
select 'non-PH number refused with the email message',
       r -> 'error' ->> 'message' = 'SMS codes work for Philippine numbers only. Use your email instead.'
         and (r -> 'error' ->> 'http_code')::int = 400,
       r::text
  from (select public.send_sms_semaphore(pg_temp.event('971501234567')) r) x;
insert into results select 'Indonesian number refused', (public.send_sms_semaphore(pg_temp.event('6281234567890')) ? 'error'), null;
insert into results select 'PH landline refused', (public.send_sms_semaphore(pg_temp.event('6328123456')) ? 'error'), null;
insert into results select 'nothing sent for refused numbers', (select count(*) = 0 from net.calls), null;

-- ── 2. A PH mobile number is sent through Semaphore's priority route ──────────
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
insert into results
select 'the send is logged as queued with its pg_net request id',
       s.status = 'queued' and s.net_request_id = (select max(id) from net.calls), s.status
  from private.sms_otp_sends s order by s.id desc limit 1;

-- ── 3. 60-second cooldown per number ──────────────────────────────────────────
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

-- ── 4. Daily cap: 5 texts per number in 24 hours ──────────────────────────────
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

-- ── 5. The log never holds the number or the code ─────────────────────────────
insert into results
select 'log has no phone number or code',
       not exists (select 1 from private.sms_otp_sends s where s::text like '%9171234567%' or s::text like '%12345678%'),
       null;

-- ── 6. Which number gets the text (no SMS type in the payload) ───────────────
truncate private.sms_otp_sends;
select public.send_sms_semaphore(pg_temp.event('639171112222', '11111111', '639289990000', now() - interval '2 days'));
insert into results
select 'stale unconfirmed phone change: the code goes to the confirmed phone, not new_phone',
       c.body ->> 'number' = '639171112222', c.body::text
  from net.calls c order by c.id desc limit 1;
select public.send_sms_semaphore(pg_temp.event('639171113333', '22222222', '639289991111', null));
insert into results
select 'pending change with no sent time: confirmed phone',
       c.body ->> 'number' = '639171113333', c.body::text
  from net.calls c order by c.id desc limit 1;
select public.send_sms_semaphore(pg_temp.event('639171114444', '33333333', '639289992222', now() - interval '2 minutes'));
insert into results
select 'phone change started 2 minutes ago: new_phone',
       c.body ->> 'number' = '639289992222', c.body::text
  from net.calls c order by c.id desc limit 1;
insert into vault.secrets (name, secret) values ('SEMAPHORE_SENDER_NAME', 'Moodeng');
select public.send_sms_semaphore(pg_temp.event('', '87654321', '639285556666'));
insert into results
select 'adding a first phone (no confirmed phone): new_phone, with the Vault sender name',
       c.body ->> 'number' = '639285556666' and c.body ->> 'sendername' = 'Moodeng',
       c.body::text
  from net.calls c order by c.id desc limit 1;
delete from vault.secrets where name = 'SEMAPHORE_SENDER_NAME';

-- ── 7. Salt missing: fail closed ──────────────────────────────────────────────
truncate private.sms_otp_sends;
update vault.secrets set name = 'SMS_PHONE_HASH_SALT_parked' where name = 'SMS_PHONE_HASH_SALT';
create temp table no_salt as select public.send_sms_semaphore(pg_temp.event('639171234567')) r;
insert into results
select 'no salt: refused with "not available", nothing sent',
       r -> 'error' ->> 'message' = 'Text codes are not available right now. Use your email instead.'
         and (select count(*) from private.sms_otp_sends where status = 'queued') = 0
         and (select status from private.sms_otp_sends order by id desc limit 1) = 'error_no_salt',
       r::text
  from no_salt;
insert into results
select 'no salt: no unsalted hash is stored', not exists (select 1 from private.sms_otp_sends where phone_hash ~ '^[0-9a-f]{64}$'), null;
update vault.secrets set name = 'SMS_PHONE_HASH_SALT' where name = 'SMS_PHONE_HASH_SALT_parked';
truncate private.sms_alerts;

-- ── 8. Reconcile: queued -> sent / failed ─────────────────────────────────────
truncate private.sms_otp_sends;
select public.send_sms_semaphore(pg_temp.event('639170000001'));
select pg_temp.respond(pg_temp.last_send_id(), 200, '[{"message_id":1,"recipient":"639170000001","message":"Your Moodeng code is 12345678.","status":"Pending"}]');
select public.send_sms_semaphore(pg_temp.event('639170000002'));
select pg_temp.respond(pg_temp.last_send_id(), 200, '{"sendername":["The selected sendername is invalid."]}');
select public.send_sms_semaphore(pg_temp.event('639170000003'));
select pg_temp.respond(pg_temp.last_send_id(), 500, 'Server Error');
select public.send_sms_semaphore(pg_temp.event('639170000004'));
select pg_temp.respond(pg_temp.last_send_id(), null, null, true, null);
select public.send_sms_semaphore(pg_temp.event('639170000005'));  -- no response yet
select private.sms_otp_reconcile();

insert into results
select 'Semaphore success list -> sent',
       (select status from private.sms_otp_sends where phone_hash = private.sms_phone_hash('639170000001')) = 'sent', null;
insert into results
select 'HTTP 200 with an error object -> failed, reason names the field only',
       (select status = 'failed' and failure_reason = 'semaphore: sendername' from private.sms_otp_sends where phone_hash = private.sms_phone_hash('639170000002')), null;
insert into results
select 'HTTP 500 -> failed (http 500)',
       (select status = 'failed' and failure_reason = 'http 500' from private.sms_otp_sends where phone_hash = private.sms_phone_hash('639170000003')), null;
insert into results
select 'timeout -> failed (timeout)',
       (select status = 'failed' and failure_reason = 'timeout' from private.sms_otp_sends where phone_hash = private.sms_phone_hash('639170000004')), null;
insert into results
select 'no response yet -> still queued',
       (select status from private.sms_otp_sends where phone_hash = private.sms_phone_hash('639170000005')) = 'queued', null;
insert into results
select 'failure reasons never contain the code', not exists (select 1 from private.sms_otp_sends where failure_reason like '%12345678%'), null;

-- ── 9. Failed sends don't count toward the limits ─────────────────────────────
insert into results
select 'a failed send does not trigger the 60s cooldown',
       public.send_sms_semaphore(pg_temp.event('639170000002')) = '{}'::jsonb, null;
insert into results
select 'a successful send still does',
       public.send_sms_semaphore(pg_temp.event('639170000001')) ? 'error', null;

-- ── 10. Alerts: recorded without a webhook, posted once per window with one ───
insert into results
select 'failures recorded as an alert (no webhook in Vault: not delivered)',
       exists (select 1 from private.sms_alerts where kind = 'send_failed' and not delivered and message like '3 text(s) failed%'), null;
truncate private.sms_alerts;
insert into vault.secrets (name, secret) values ('DISCORD_SMS_ALERTS_WEBHOOK_URL', 'https://discord.test/webhook');
select pg_temp.respond(pg_temp.last_send_id(), 200, '{"number":["The number format is invalid."]}');
select private.sms_otp_reconcile();
insert into results
select 'with the Vault webhook, a failure posts to Discord',
       c.url = 'https://discord.test/webhook' and c.body ->> 'content' like '%1 text(s) failed%semaphore: number%', c.body::text
  from net.calls c order by c.id desc limit 1;
select public.send_sms_semaphore(pg_temp.event('639170000006'));
select pg_temp.respond(pg_temp.last_send_id(), 502, 'Bad gateway');
select private.sms_otp_reconcile();
insert into results
select 'a second failure within the hour does not post again',
       (select count(*) from net.calls where url = 'https://discord.test/webhook') = 1, null;
select pg_temp.age_sends('20 minutes');
select private.sms_otp_reconcile();
insert into results
select 'no response for 15 minutes -> failed',
       (select status = 'failed' and failure_reason = 'no response within 15 minutes' from private.sms_otp_sends where phone_hash = private.sms_phone_hash('639170000005')), null;

-- ── 11. Purge of pg_net rows holding codes / the API key ──────────────────────
insert into results
select 'our Semaphore responses older than 15 minutes are deleted',
       not exists (select 1 from net._http_response r join private.sms_otp_sends s on s.net_request_id = r.id), null;
insert into results
select 'our queued requests older than 15 minutes are deleted',
       not exists (select 1 from net.http_request_queue q join private.sms_otp_sends s on s.net_request_id = q.id), null;
insert into net._http_response (id, status_code, content, created) values (999999, 200, 'someone else''s request', now() - interval '1 hour');
select private.sms_otp_reconcile();
insert into results
select 'other pg_net rows are left alone', exists (select 1 from net._http_response where id = 999999), null;
select public.send_sms_semaphore(pg_temp.event('639170000007'));
select pg_temp.respond(pg_temp.last_send_id(), 200, '[{"message_id":7,"status":"Pending"}]');
select private.sms_otp_reconcile();
insert into results
select 'a fresh response is kept until 15 minutes', exists (select 1 from net._http_response where id = pg_temp.last_send_id()), null;

-- ── 12. Overall daily brake: 300 texts in 24 hours ────────────────────────────
truncate private.sms_alerts;
insert into private.sms_otp_sends (phone_hash, status, created_at)
select 'bulk-' || g, 'sent', now() - interval '1 hour' from generate_series(1, 300) g;
insert into results
select 'over 300 texts a day: refused with a friendly message',
       public.send_sms_semaphore(pg_temp.event('639179998888')) -> 'error' ->> 'message' = 'Text codes are busy right now. Use your email instead, or try again later.',
       null;
delete from private.sms_alerts;  -- as if Auth rolled the hook's alert back
select private.sms_otp_reconcile();
insert into results
select 'the reconcile job alerts about the daily brake',
       exists (select 1 from private.sms_alerts where kind = 'global_cap' and delivered), null;
update private.sms_otp_sends set created_at = now() - interval '2 days' where phone_hash like 'bulk-%';
insert into results
select 'the brake lifts after 24 hours', public.send_sms_semaphore(pg_temp.event('639179998888')) = '{}'::jsonb, null;

-- ── 13. Credit balance check ──────────────────────────────────────────────────
select private.sms_request_semaphore_balance();
insert into results
select 'hourly balance check asks GET /account with the Vault key',
       c.url = 'https://api.semaphore.co/api/v4/account' and c.params ->> 'apikey' = 'test-semaphore-key', c.url
  from net.calls c order by c.id desc limit 1;
select pg_temp.respond((select max(net_request_id) from private.semaphore_balance_checks), 200, '{"account_id":1,"status":"Active","credit_balance":1010}');
select private.sms_otp_reconcile();
insert into results
select 'plenty of credit: balance stored, no alert',
       (select credit_balance from private.semaphore_balance_checks order by net_request_id desc limit 1) = 1010
         and not exists (select 1 from private.sms_alerts where kind = 'low_credit'), null;
select private.sms_request_semaphore_balance();
select pg_temp.respond((select max(net_request_id) from private.semaphore_balance_checks), 200, '{"credit_balance":120}');
select private.sms_otp_reconcile();
insert into results
select 'low credit: alert',
       exists (select 1 from private.sms_alerts where kind = 'low_credit' and message like 'Only 120 Semaphore credits left (about 60 texts%'), null;
select private.sms_request_semaphore_balance();
select pg_temp.respond((select max(net_request_id) from private.semaphore_balance_checks), 200, 'not json');
insert into results
select 'an unreadable balance response does not break the job', (private.sms_otp_reconcile() ? 'sent'), null;

-- ── 14. Retention, cron jobs, grants ──────────────────────────────────────────
insert into private.sms_otp_sends (phone_hash, status, created_at) values ('old', 'sent', now() - interval '91 days');
select private.sms_otp_reconcile();
insert into results
select 'log rows older than 90 days are deleted', not exists (select 1 from private.sms_otp_sends where phone_hash = 'old'), null;
insert into results
select 'cron jobs scheduled (reconcile every 2 min, balance hourly)',
       exists (select 1 from cron.job where jobname = 'sms-otp-reconcile-2min' and schedule = '*/2 * * * *')
         and exists (select 1 from cron.job where jobname = 'sms-semaphore-balance-hourly'), null;
insert into results
select 'anon/authenticated cannot call the hook or the jobs; supabase_auth_admin can call the hook',
       not has_function_privilege('anon', 'public.send_sms_semaphore(jsonb)', 'execute')
         and not has_function_privilege('authenticated', 'public.send_sms_semaphore(jsonb)', 'execute')
         and not has_function_privilege('authenticated', 'private.sms_otp_reconcile(timestamptz)', 'execute')
         and has_function_privilege('supabase_auth_admin', 'public.send_sms_semaphore(jsonb)', 'execute'),
       null;

select name, ok, detail from results where not ok;
select count(*) filter (where ok) || '/' || count(*) || ' passed' as summary from results;

\else
-- Part 1: stand-ins for Supabase's vault, pg_net, pg_cron, pgcrypto and roles.
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

-- pg_net: net.calls is a permanent test log; http_request_queue/_http_response mimic the real tables.
create schema if not exists net;
create sequence if not exists net.request_ids;
create table if not exists net.calls (id bigint primary key, url text, body jsonb, params jsonb, headers jsonb);
create table if not exists net.http_request_queue (id bigint primary key, method text, url text, headers jsonb, body bytea, timeout_milliseconds int);
create table if not exists net._http_response (id bigint, status_code int, content_type text, headers jsonb, content text, timed_out boolean, error_msg text, created timestamptz not null default now());
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$
declare v_id bigint := nextval('net.request_ids');
begin
  insert into net.calls (id, url, body, params, headers) values (v_id, url, body, params, headers);
  insert into net.http_request_queue (id, method, url, headers, body, timeout_milliseconds) values (v_id, 'POST', url, headers, convert_to(body::text, 'UTF8'), timeout_milliseconds);
  return v_id;
end $$;
create or replace function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language plpgsql as $$
declare v_id bigint := nextval('net.request_ids');
begin
  insert into net.calls (id, url, params, headers) values (v_id, url, params, headers);
  insert into net.http_request_queue (id, method, url, headers, timeout_milliseconds) values (v_id, 'GET', url, headers, timeout_milliseconds);
  return v_id;
end $$;

create schema if not exists cron;
create table if not exists cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create or replace function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid;
$$;
create or replace function cron.unschedule(job_name text) returns boolean language plpgsql as $$
begin
  delete from cron.job where jobname = job_name;
  if not found then raise exception 'could not find valid entry for job "%"', job_name; end if;
  return true;
end $$;
\endif
