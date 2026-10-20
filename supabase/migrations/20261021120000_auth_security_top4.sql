-- Security audit 2026-10-21 (login, sign-up, onboarding): the top findings.

-- 1. public_user_profiles runs as its owner (it must read other people's rows past RLS) and anon can
--    read it, so anyone with the public key could list every user's income, expenses, payday, reasons
--    for borrowing and KYC status. Lenders still see a borrower's income bracket on the loan card, so
--    those columns stay for signed-in users only. KYC status is only ever the person's own.
create or replace view public.public_user_profiles with (security_invoker = false) as
select
   id,
   null::text as wallet_address,
   username,
   null::text as email,
   null::text as google_id,
   null::bigint as telegram_id,
   null::text as telegram_username,
   null::bigint as chat_id,
   is_world_id,
   null::text as nullifier_hash,
   null::integer as mal,
   null::integer as nal,
   null::integer as cs,
   null::text as reset_token,
   null::timestamp with time zone as reset_token_expiry,
   created_at,
   updated_at,
   null::boolean as credit_progression_paused,
   user_role,
   null::account_status as account_status,
   null::uuid as redeemed_referral_code_id,
   null::numeric as referral_boost_amount,
   null::text as wallet_provider,
   null::text as wallet_connector_name,
   null::integer as wallet_chain_id,
   null::timestamp with time zone as wallet_connected_at,
   null::integer as current_risk_score,
   null::text as current_risk_band,
   null::timestamp with time zone as risk_computed_at,
   display_name,
   case when auth.uid() is not null then income_type end as income_type,
   case when auth.uid() is not null then payday_type end as payday_type,
   case when auth.uid() is not null then payday_start end as payday_start,
   case when auth.uid() is not null then payday_end end as payday_end,
   case when auth.uid() is not null then gap_reasons end as gap_reasons,
   null::boolean as notif_account_activity,
   null::boolean as notif_transaction_activity,
   null::boolean as notif_blogs,
   case when auth.uid() is not null then profession end as profession,
   null::text as location,
   case when auth.uid() is not null then other_income end as other_income,
   case when auth.uid() is not null then monthly_income end as monthly_income,
   case when auth.uid() is not null then monthly_expenses end as monthly_expenses,
   null::text as is_veriff,
   null::text as income_description,
   is_didit,
   null::text as liveness_status,
   null::text as liveness_session_id,
   null::text as line_id,
   case when id = auth.uid() then didit_submitted_at end as didit_submitted_at,
   case when id = auth.uid() then didit_id_status end as didit_id_status,
   null::text as didit_decline_reason,
   null::text as didit_session_id,
   null::text as didit_session_url,
   null::text as didit_notify_marker
from public.users;

-- 2. Telegram/LINE logins reuse an existing account at their email. telegram-login and line-login now
--    lock down any existing account that isn't marked as theirs (app_metadata telegram_id / line_id)
--    before signing in: new random password, every session ended. This ends the sessions.
create or replace function public.revoke_auth_sessions(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
   delete from auth.sessions where user_id = p_user_id;
$$;
revoke all on function public.revoke_auth_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_auth_sessions(uuid) to service_role;

--    Accounts made before the marker existed: mark the ones whose profile already carries the same
--    Telegram/LINE id (server-set columns), so their next login doesn't log them out everywhere.
update auth.users a
set raw_app_meta_data = coalesce(a.raw_app_meta_data, '{}'::jsonb)
   || jsonb_build_object('telegram_id', substring(a.email from '^telegram_(\d+)@'))
from public.users u
where u.id = a.id
  and a.email ~* '^telegram_\d+@moodeng\.(app|credit)$'
  and a.email_confirmed_at is not null
  and not (coalesce(a.raw_app_meta_data, '{}'::jsonb) ? 'telegram_id')
  and u.telegram_id::text = substring(a.email from '^telegram_(\d+)@');

update auth.users a
set raw_app_meta_data = coalesce(a.raw_app_meta_data, '{}'::jsonb)
   || jsonb_build_object('line_id', substring(a.email from '^line_([^@]+)@'))
from public.users u
where u.id = a.id
  and a.email ~* '^line_[^@]+@moodeng\.(app|credit)$'
  and a.email_confirmed_at is not null
  and not (coalesce(a.raw_app_meta_data, '{}'::jsonb) ? 'line_id')
  and lower(u.line_id) = lower(substring(a.email from '^line_([^@]+)@'));

-- 4. The pre-KYC gate (Messenger, bio, call) only applies to borrowers, and anyone can pick "lender" at
--    sign-up. Nothing stopped a lender account from then requesting loans, so "lender" was a way around
--    the gate. Lender accounts can't request loans (one did, last in June 2026: a test account).
create or replace function app_private.enforce_borrower_role_on_loan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
   v_jwt_role text;
begin
   -- Same caller check as enforce_borrower_credit_limits: only gate app clients.
   v_jwt_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user::text);
   if v_jwt_role not in ('authenticated', 'anon') then
      return new;
   end if;
   if exists (select 1 from public.users u where u.id = new.borrower_user_id and u.user_role::text = 'lender') then
      raise exception 'loans: lender accounts can''t request loans. Sign up with a borrower account to borrow.'
         using errcode = 'P0001';
   end if;
   return new;
end;
$$;
revoke all on function app_private.enforce_borrower_role_on_loan() from public, anon, authenticated;

drop trigger if exists trg_enforce_borrower_role_on_loan on public.loans;
create trigger trg_enforce_borrower_role_on_loan
   before insert on public.loans
   for each row execute function app_private.enforce_borrower_role_on_loan();
