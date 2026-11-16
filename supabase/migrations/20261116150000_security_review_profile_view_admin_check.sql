-- Security review fixes (2026-11-16).
--
-- 1. public_user_profiles showed every user's income, expenses, profession and payday to ANY signed-in
--    account, including anonymous guest accounts that anyone can create. Lenders need those fields on
--    the request board, so they stay visible, but only to a real (non-guest) account, and only for:
--    yourself, admins, a borrower with an open request, or a borrower whose loan you lent.
-- 2. private.current_user_is_admin() ignored admin_users.active, so a deactivated admin could still read
--    referral claims and account-status logs. It now matches app_private.is_moodeng_admin().

create or replace function private.can_see_borrower_finances(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
   select auth.uid() is not null
      and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
      and (
         p_target = auth.uid()
         or app_private.is_moodeng_admin()
         or exists (
            select 1
            from public.loans l
            where l.borrower_user_id = p_target
              and (l.loan_status = 'Requested'::public.loan_status or l.lender_user_id = auth.uid())
         )
      );
$$;

revoke all on function private.can_see_borrower_finances(uuid) from public;
-- The view checks EXECUTE as the caller, so both API roles need it (it only reveals what the view shows).
grant execute on function private.can_see_borrower_finances(uuid) to anon, authenticated;

create or replace view public.public_user_profiles as
 select u.id,
    null::text as wallet_address,
    u.username,
    null::text as email,
    null::text as google_id,
    null::bigint as telegram_id,
    null::text as telegram_username,
    null::bigint as chat_id,
    u.is_world_id,
    null::text as nullifier_hash,
    null::integer as mal,
    null::integer as nal,
    null::integer as cs,
    null::text as reset_token,
    null::timestamp with time zone as reset_token_expiry,
    u.created_at,
    u.updated_at,
    null::boolean as credit_progression_paused,
    u.user_role,
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
    u.display_name,
    case when f.ok then u.income_type else null::text end as income_type,
    case when f.ok then u.payday_type else null::text end as payday_type,
    case when f.ok then u.payday_start else null::smallint end as payday_start,
    case when f.ok then u.payday_end else null::smallint end as payday_end,
    case when f.ok then u.gap_reasons else null::text[] end as gap_reasons,
    null::boolean as notif_account_activity,
    null::boolean as notif_transaction_activity,
    null::boolean as notif_blogs,
    case when f.ok then u.profession else null::text end as profession,
    null::text as location,
    case when f.ok then u.other_income else null::text end as other_income,
    case when f.ok then u.monthly_income else null::text end as monthly_income,
    case when f.ok then u.monthly_expenses else null::text end as monthly_expenses,
    null::text as is_veriff,
    null::text as income_description,
    u.is_didit,
    null::text as liveness_status,
    null::text as liveness_session_id,
    null::text as line_id,
    case when u.id = auth.uid() then u.didit_submitted_at else null::timestamp with time zone end as didit_submitted_at,
    case when u.id = auth.uid() then u.didit_id_status else null::text end as didit_id_status,
    null::text as didit_decline_reason,
    null::text as didit_session_id,
    null::text as didit_session_url,
    null::text as didit_notify_marker
   from public.users u
   cross join lateral (
      select case when auth.uid() is null then false else private.can_see_borrower_finances(u.id) end as ok
   ) f;

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
   select exists (
      select 1 from public.admin_users where user_id = auth.uid() and active = true
   );
$$;
