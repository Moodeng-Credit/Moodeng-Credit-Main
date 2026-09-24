-- Behaviour tests for migration 20260924000000_friend_referrals_and_vouchers.sql.
--
-- Run against a THROWAWAY Postgres database only (never production). This file creates minimal
-- stand-ins for the Supabase pieces the migration needs (auth.uid(), anon/authenticated roles,
-- users, loans, admin_users, app_private.is_moodeng_admin), then applies the migration yourself:
--
--   createdb reftest
--   psql -d reftest -f supabase/tests/friend_referrals_and_vouchers.test.sql   -- part 1 creates stubs
--   psql -d reftest -f supabase/migrations/20260924000000_friend_referrals_and_vouchers.sql
--   psql -d reftest -v run_tests=1 -f supabase/tests/friend_referrals_and_vouchers.test.sql
--
-- Expected final line: "24/24 passed".

\if :{?run_tests}
\set ON_ERROR_STOP 1
insert into public.users (id, username, display_name, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'alice', 'Alice Reyes', now() - interval '60 days'),
  ('00000000-0000-0000-0000-00000000000b', 'bea', null, now()),
  ('00000000-0000-0000-0000-00000000000c', 'carl', null, now() - interval '30 days'),
  ('00000000-0000-0000-0000-00000000000d', 'dina', null, now()),
  ('00000000-0000-0000-0000-0000000000ad', 'admin', null, now() - interval '400 days');
insert into public.admin_users (user_id) values ('00000000-0000-0000-0000-0000000000ad');

create temp table results (name text, ok boolean, detail text);
grant all on results to authenticated, anon;

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false); end $$;

-- 1-3: invite code creation, stability, public inviter lookup, self-referral
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into results select 'code format', get_my_invite_code() ~ '^[A-Z]{6}[0-9]{5}$', get_my_invite_code();
insert into results select 'code is stable', (select get_my_invite_code()) = (select get_my_invite_code()), null;
insert into results select 'self referral blocked', redeem_friend_invite(get_my_invite_code()) = 'self_referral', null;
reset role;
create temp table alice_code as select code from public.borrower_invite_codes where user_id = '00000000-0000-0000-0000-00000000000a';
grant select on alice_code to anon, authenticated;

set role anon;
select pg_temp.as_user(null);
insert into results select 'anon sees inviter first name only', get_invite_inviter((select lower(code) from alice_code)) = 'Alice', get_invite_inviter((select code from alice_code));
reset role;

-- 4-5: redemption rules
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into results select 'invalid code', redeem_friend_invite('ZZZZZZ00000') = 'invalid_code', null;
insert into results select 'new account joins', redeem_friend_invite((select code from alice_code)) = 'joined', null;
insert into results select 'second redeem blocked', redeem_friend_invite((select code from alice_code)) = 'already_referred', null;
insert into results select 'cannot read inviter code row (RLS)', (select count(*) from public.borrower_invite_codes) = 0, null;
insert into results select 'nothing claimable before repayment', (get_my_rewards() -> 'claimable') = '[]'::jsonb, (get_my_rewards())::text;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into results select 'old account rejected', redeem_friend_invite((select code from alice_code)) = 'not_a_new_account', null;
reset role;

-- 6: ineligible claim is rejected
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  perform submit_voucher_claim('referral_invitee', (select id from public.friend_referrals limit 1), 'Bea Cruz', '09171234567', null);
  insert into results values ('ineligible claim rejected', false, 'was accepted');
exception when others then insert into results values ('ineligible claim rejected', sqlerrm = 'not eligible for this voucher', sqlerrm);
end $$;
do $$ begin
  insert into public.voucher_claims (user_id, reward, amount_php, full_name, mobile) values (auth.uid(), 'first_on_time_repayment', 999, 'Hack', '09170000000');
  insert into results values ('direct insert blocked', false, 'insert allowed');
exception when others then insert into results values ('direct insert blocked', true, sqlerrm);
end $$;
reset role;

-- 7: Bea repays on time (within 24h grace); Dina repays late; Carl's only loan was refunded
insert into public.loans (borrower_user_id, loan_amount, repaid_amount, total_repayment_amount, repayment_status, loan_status, due_date, repaid_at) values
  ('00000000-0000-0000-0000-00000000000b', 15, 18, 18, 'Paid', 'Lent', now() - interval '2 days', now() - interval '2 days' + interval '20 hours'),
  ('00000000-0000-0000-0000-00000000000d', 15, 18, 18, 'Paid', 'Lent', now() - interval '5 days', now() - interval '2 days'),
  ('00000000-0000-0000-0000-00000000000c', 15, 18, 18, 'Paid', 'Lent', now() - interval '5 days', now() - interval '6 days');
update public.loans set refunded_at = now() where borrower_user_id = '00000000-0000-0000-0000-00000000000c';

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into results select 'invitee: own ₱50 + referral ₱100 claimable', jsonb_array_length(get_my_rewards() -> 'claimable') = 2, (get_my_rewards() -> 'claimable')::text;
insert into results select 'claim accepted', submit_voucher_claim('first_on_time_repayment', null, 'Bea Cruz', '+63 917 123 4567', 'bea@example.com') is not null, null;
do $$ begin
  perform submit_voucher_claim('first_on_time_repayment', null, 'Bea Cruz', '09171234567', null);
  insert into results values ('double claim blocked', false, 'accepted twice');
exception when others then insert into results values ('double claim blocked', sqlerrm = 'voucher already claimed', sqlerrm);
end $$;
insert into results select 'claimed reward leaves claimable list', jsonb_array_length(get_my_rewards() -> 'claimable') = 1, (get_my_rewards() -> 'claims')::text;
do $$ begin
  update public.voucher_claims set status = 'sent';
  insert into results values ('borrower cannot mark own claim sent', not exists (select 1 from public.voucher_claims where status = 'sent'), 'rows updated silently: 0 expected');
exception when others then insert into results values ('borrower cannot mark own claim sent', true, sqlerrm);
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into results select 'inviter ₱100 unlocked by friend repaying', (get_my_rewards() -> 'claimable' -> 0 ->> 'reward') = 'referral_inviter', (get_my_rewards())::text;
insert into results select 'inviter counts', (get_my_rewards() ->> 'invitedCount') = '1' and (get_my_rewards() ->> 'qualifiedCount') = '1', null;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into results select 'late repayment earns nothing', (get_my_rewards() -> 'claimable') = '[]'::jsonb, null;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into results select 'refunded loan earns nothing', (get_my_rewards() -> 'claimable') = '[]'::jsonb, null;

-- 8: admin fulfilment
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
insert into results select 'admin sees all claims', (select count(*) from public.voucher_claims) = 1, null;
update public.voucher_claims set status = 'sent', sent_at = now();
insert into results select 'admin marks sent', exists (select 1 from public.voucher_claims where status = 'sent'), null;
do $$ begin
  update public.voucher_claims set amount_php = 5000;
  insert into results values ('admin cannot change amount', false, 'amount changed');
exception when others then insert into results values ('admin cannot change amount', true, sqlerrm);
end $$;
reset role;

select case when ok then 'PASS' else 'FAIL' end as result, name, left(coalesce(detail, ''), 90) as detail from results;
select count(*) filter (where ok) || '/' || count(*) || ' passed' as summary from results;
\else
-- Minimal stand-ins for the Supabase pieces the migration depends on.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated;
create table public.users (id uuid primary key, username text, display_name text, created_at timestamptz not null default now());
create table public.admin_users (user_id uuid primary key, active boolean default true);
create table public.loans (
  id uuid primary key default gen_random_uuid(), borrower_user_id uuid references public.users(id), loan_amount numeric,
  repaid_amount numeric, total_repayment_amount numeric, repayment_status text, loan_status text,
  due_date timestamptz, repaid_at timestamptz, updated_at timestamptz default now(), refunded_at timestamptz);
create or replace function app_private.is_moodeng_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and active) $$;
grant execute on function app_private.is_moodeng_admin() to authenticated;
create or replace function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
grant usage on schema public to anon, authenticated;
\endif
