-- Rejected is final (Nov 2026): a rejected borrower can't book a call or reach out again. On the
-- Telegram card the team then picks "for good" (the default) or "for now" — the latter sets
-- users.loan_access_retry_at, the day they may ask again. An hourly job puts them back to 'none'
-- once that day comes, so the app and every booking path only ever have to check 'rejected'.
--
-- Server-only, like loan_access_status: added to enforce_user_privileged_columns_server_only.

alter table public.users add column if not exists loan_access_retry_at timestamptz;

create or replace function public.enforce_user_privileged_columns_server_only()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.is_world_id is distinct from old.is_world_id
     or new.is_didit is distinct from old.is_didit
     or new.liveness_status is distinct from old.liveness_status
     or new.liveness_session_id is distinct from old.liveness_session_id
     or new.nullifier_hash is distinct from old.nullifier_hash
     or new.cs is distinct from old.cs
     or new.mal is distinct from old.mal
     or new.nal is distinct from old.nal
     or new.credit_progression_paused is distinct from old.credit_progression_paused
     or new.current_risk_score is distinct from old.current_risk_score
     or new.current_risk_band is distinct from old.current_risk_band
     or new.risk_computed_at is distinct from old.risk_computed_at
     or new.account_status is distinct from old.account_status
     or new.is_veriff is distinct from old.is_veriff
     or new.didit_id_status is distinct from old.didit_id_status
     or new.wallet_face_status is distinct from old.wallet_face_status
     or new.wallet_face_session_id is distinct from old.wallet_face_session_id
     or new.wallet_face_checked_at is distinct from old.wallet_face_checked_at
     or new.cashout_gate_exempt is distinct from old.cashout_gate_exempt
     or new.wallet_suspended is distinct from old.wallet_suspended
     or new.whatsapp_verified_at is distinct from old.whatsapp_verified_at
     or new.messenger_verified_at is distinct from old.messenger_verified_at
     or new.messenger_psid is distinct from old.messenger_psid
     or new.messenger_stuck_alerted_at is distinct from old.messenger_stuck_alerted_at
     or new.loan_access_status is distinct from old.loan_access_status
     or new.loan_access_approved_at is distinct from old.loan_access_approved_at
     or new.loan_access_retry_at is distinct from old.loan_access_retry_at
     or new.video_call_scheduled_at is distinct from old.video_call_scheduled_at
     or new.video_call_starts_at is distinct from old.video_call_starts_at
     or new.video_call_host is distinct from old.video_call_host
     or new.video_call_booking_uid is distinct from old.video_call_booking_uid
     or new.video_call_reminder_stage is distinct from old.video_call_reminder_stage
     or new.video_call_confirm_token is distinct from old.video_call_confirm_token
     or new.video_call_confirmed_at is distinct from old.video_call_confirmed_at
     or new.video_call_outcome is distinct from old.video_call_outcome
     or new.video_call_outcome_at is distinct from old.video_call_outcome_at
     or new.video_call_join_url is distinct from old.video_call_join_url
     or new.video_call_meeting_id is distinct from old.video_call_meeting_id
     or new.video_call_arrived_at is distinct from old.video_call_arrived_at
     or new.video_call_joined_at is distinct from old.video_call_joined_at
     or new.video_call_left_at is distinct from old.video_call_left_at
     or new.video_call_keep_spot_asked_at is distinct from old.video_call_keep_spot_asked_at
     or new.redeemed_referral_code_id is distinct from old.redeemed_referral_code_id
     or new.referral_boost_amount is distinct from old.referral_boost_amount
     or new.timezone is distinct from old.timezone
     or new.video_call_timezone is distinct from old.video_call_timezone
     or new.didit_session_id is distinct from old.didit_session_id
     or new.didit_session_url is distinct from old.didit_session_url
     or new.didit_decline_reason is distinct from old.didit_decline_reason
     or new.didit_submitted_at is distinct from old.didit_submitted_at
     or new.telegram_id is distinct from old.telegram_id
     or new.line_id is distinct from old.line_id
  then
    raise exception 'users: verification/credit columns can only be written by verified server-side code';
  end if;

  return new;
end;
$function$;

-- Rejected "for now" → back to 'none' when their retry day arrives.
do $$
begin
   perform cron.unschedule('loan-access-retry-hourly');
exception
   when others then
      null;
end $$;

select cron.schedule(
   'loan-access-retry-hourly',
   '12 * * * *',
   $$
   update public.users
      set loan_access_status = 'none', loan_access_retry_at = null
    where loan_access_status = 'rejected'
      and loan_access_retry_at is not null
      and loan_access_retry_at <= now()
   $$
);
