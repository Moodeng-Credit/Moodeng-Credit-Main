-- Login and ID-check holes (review, 2026-10-02).
--
-- 1) users.didit_session_id (and the other Didit session fields) were client-writable, so a user could
--    copy a verified account's Didit session onto a second account and have check-didit-status approve
--    it with no new scan (and around the first account's blacklist). They're now server-only, on
--    update and on insert. check-didit-status also refuses a session whose vendor_data isn't the caller.
-- 2) offplatform_settled_at / _note / _by were client-writable: a borrower could mark a refunded loan
--    settled off-platform (the lender then sees REPAID) and overwrite the admin's private note.

create or replace function public.enforce_user_privileged_columns_server_only()
returns trigger
language plpgsql
set search_path to 'public'
as $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN new;
  END IF;

  IF new.is_world_id IS DISTINCT FROM old.is_world_id
     OR new.is_didit IS DISTINCT FROM old.is_didit
     OR new.liveness_status IS DISTINCT FROM old.liveness_status
     OR new.liveness_session_id IS DISTINCT FROM old.liveness_session_id
     OR new.nullifier_hash IS DISTINCT FROM old.nullifier_hash
     OR new.cs IS DISTINCT FROM old.cs
     OR new.mal IS DISTINCT FROM old.mal
     OR new.nal IS DISTINCT FROM old.nal
     OR new.credit_progression_paused IS DISTINCT FROM old.credit_progression_paused
     OR new.current_risk_score IS DISTINCT FROM old.current_risk_score
     OR new.current_risk_band IS DISTINCT FROM old.current_risk_band
     OR new.risk_computed_at IS DISTINCT FROM old.risk_computed_at
     OR new.account_status IS DISTINCT FROM old.account_status
     OR new.is_veriff IS DISTINCT FROM old.is_veriff
     OR new.didit_id_status IS DISTINCT FROM old.didit_id_status
     OR new.wallet_face_status IS DISTINCT FROM old.wallet_face_status
     OR new.wallet_face_session_id IS DISTINCT FROM old.wallet_face_session_id
     OR new.wallet_face_checked_at IS DISTINCT FROM old.wallet_face_checked_at
     -- Cash-out gate exemption (20260820110000). Client-writable would mean self-release.
     OR new.cashout_gate_exempt IS DISTINCT FROM old.cashout_gate_exempt
     -- Proven contact lines (20260921000000 / 20260922000000). Only the webhooks may stamp these.
     OR new.whatsapp_verified_at IS DISTINCT FROM old.whatsapp_verified_at
     OR new.messenger_verified_at IS DISTINCT FROM old.messenger_verified_at
     OR new.messenger_psid IS DISTINCT FROM old.messenger_psid
     -- Stuck-confirmation team alert.
     OR new.messenger_stuck_alerted_at IS DISTINCT FROM old.messenger_stuck_alerted_at
     -- Connect → Approve → Apply gate (20260924150000).
     OR new.loan_access_status IS DISTINCT FROM old.loan_access_status
     OR new.loan_access_approved_at IS DISTINCT FROM old.loan_access_approved_at
     -- Video-call booking + attendance (20260924150000).
     OR new.video_call_scheduled_at IS DISTINCT FROM old.video_call_scheduled_at
     OR new.video_call_starts_at IS DISTINCT FROM old.video_call_starts_at
     OR new.video_call_host IS DISTINCT FROM old.video_call_host
     OR new.video_call_booking_uid IS DISTINCT FROM old.video_call_booking_uid
     OR new.video_call_reminder_stage IS DISTINCT FROM old.video_call_reminder_stage
     OR new.video_call_confirm_token IS DISTINCT FROM old.video_call_confirm_token
     OR new.video_call_confirmed_at IS DISTINCT FROM old.video_call_confirmed_at
     OR new.video_call_outcome IS DISTINCT FROM old.video_call_outcome
     OR new.video_call_outcome_at IS DISTINCT FROM old.video_call_outcome_at
     OR new.video_call_join_url IS DISTINCT FROM old.video_call_join_url
     OR new.video_call_meeting_id IS DISTINCT FROM old.video_call_meeting_id
     OR new.video_call_arrived_at IS DISTINCT FROM old.video_call_arrived_at
     OR new.video_call_joined_at IS DISTINCT FROM old.video_call_joined_at
     OR new.video_call_left_at IS DISTINCT FROM old.video_call_left_at
     OR new.video_call_keep_spot_asked_at IS DISTINCT FROM old.video_call_keep_spot_asked_at
     -- Referral (gate bypass as of 20260924150000).
     OR new.redeemed_referral_code_id IS DISTINCT FROM old.redeemed_referral_code_id
     OR new.referral_boost_amount IS DISTINCT FROM old.referral_boost_amount
     -- Deadline zone (20261002090000). Only set_my_timezone / the Cal.com functions write these.
     OR new.timezone IS DISTINCT FROM old.timezone
     OR new.video_call_timezone IS DISTINCT FROM old.video_call_timezone
     -- Didit sessions (20261002230000): only create-didit-session / the webhook write these. A copied
     -- session id let a second account claim the first account's ID check.
     OR new.didit_session_id IS DISTINCT FROM old.didit_session_id
     OR new.didit_session_url IS DISTINCT FROM old.didit_session_url
     OR new.didit_decline_reason IS DISTINCT FROM old.didit_decline_reason
     OR new.didit_submitted_at IS DISTINCT FROM old.didit_submitted_at
  THEN
    RAISE EXCEPTION 'users: verification/credit columns can only be written by verified server-side code';
  END IF;

  RETURN new;
END;
$$;

create or replace function app_private.reset_didit_session_columns_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.didit_session_id := null;
    new.didit_session_url := null;
    new.didit_decline_reason := null;
    new.didit_submitted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reset_didit_session_columns_on_insert on public.users;
create trigger trg_reset_didit_session_columns_on_insert
  before insert on public.users
  for each row execute function app_private.reset_didit_session_columns_on_insert();

create or replace function app_private.keep_offplatform_settlement_server_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.offplatform_settled_at := null;
    new.offplatform_settlement_note := null;
    new.offplatform_settled_by := null;
  elsif new.offplatform_settled_at is distinct from old.offplatform_settled_at
     or new.offplatform_settlement_note is not null
     or new.offplatform_settled_by is distinct from old.offplatform_settled_by then
    raise exception 'loans: off-platform settlement can only be recorded by an admin';
  end if;
  return new;
end;
$$;

-- "zy_" runs just before zz_divert_loan_private_notes, so a client's note is rejected rather than
-- diverted into the admin's private note.
drop trigger if exists zy_keep_offplatform_settlement_server_only on public.loans;
create trigger zy_keep_offplatform_settlement_server_only
  before insert or update on public.loans
  for each row execute function app_private.keep_offplatform_settlement_server_only();
