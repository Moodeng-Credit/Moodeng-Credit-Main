-- Booking and hold follow-ups (review, 2026-10-03).
--
-- 1) Open-flow no-shows are logged (public.video_call_no_shows) so the two-strikes rebooking cooldown
--    also applies in the open flow; before, it only read gated-flow loan_access_requests.
-- 2) A rebooking released a no-show hold and a cancel never put it back, so "book, then cancel" made a
--    no-show's request fundable again with no call. Booking now marks the request 'rebooked' (visible,
--    as before); a cancel or released slot before the new call happens puts the no-show hold back.
-- 3) approve_borrower_on_open_flow_loan approved anyone posting in the open flow, including requests
--    created on hold. A held request no longer approves its borrower, so switching to the 'call' flow
--    won't let in people who never attended.
-- 4) users.telegram_id / line_id become server-only on update.

create table if not exists public.video_call_no_shows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  active boolean not null default true
);
create index if not exists video_call_no_shows_user_idx on public.video_call_no_shows (user_id, recorded_at desc);
alter table public.video_call_no_shows enable row level security;
revoke all on public.video_call_no_shows from anon, authenticated;
drop policy if exists "admins read no-shows" on public.video_call_no_shows;
create policy "admins read no-shows" on public.video_call_no_shows for select to authenticated using (app_private.is_moodeng_admin());

create or replace function app_private.hold_requests_on_call_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  unannounced_ids uuid[] := '{}';
  loan_id uuid;
begin
  if new.video_call_outcome = 'no_show' and old.video_call_outcome is distinct from 'no_show' then
    insert into public.video_call_no_shows (user_id) values (new.id);
    -- Visible requests, and ones a rebooking had put back on the board, go on hold.
    update public.loans
       set on_hold_since = now(), on_hold_reason = 'no_show'
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and (on_hold_since is null or on_hold_reason = 'rebooked');
    return new;
  end if;

  if new.video_call_outcome = 'attended' and old.video_call_outcome is distinct from 'attended' then
    -- Held since it was posted (lenders never saw it): announce once released.
    select coalesce(array_agg(l.id), '{}') into unannounced_ids
      from public.loans as l
     where l.borrower_user_id = new.id
       and l.loan_status = 'Requested'
       and l.on_hold_since is not null
       and l.on_hold_since <= l.created_at + interval '10 seconds';
    update public.loans
       set on_hold_since = null, on_hold_reason = null
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason in ('no_show', 'awaiting_call', 'rebooked');
  elsif new.video_call_starts_at is not null
     and new.video_call_starts_at is distinct from old.video_call_starts_at
     and new.video_call_starts_at > now() then
    -- A new booking puts a no-show's request back on the board, remembered as 'rebooked' until the
    -- call happens (a cancel puts the hold back).
    select coalesce(array_agg(l.id), '{}') into unannounced_ids
      from public.loans as l
     where l.borrower_user_id = new.id
       and l.loan_status = 'Requested'
       and l.on_hold_reason = 'no_show'
       and l.on_hold_since <= l.created_at + interval '10 seconds';
    update public.loans
       set on_hold_since = null, on_hold_reason = 'rebooked'
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason = 'no_show';
  elsif old.video_call_starts_at is not null
     and new.video_call_starts_at is null
     and old.video_call_starts_at > now() then
    -- The new call was cancelled or its slot released before it happened: back on hold.
    update public.loans
       set on_hold_since = now(), on_hold_reason = 'no_show'
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason = 'rebooked';
    return new;
  else
    return new;
  end if;

  foreach loan_id in array unannounced_ids loop
    perform private.announce_loan_request(loan_id, true);
  end loop;
  return new;
end;
$$;

create or replace function private.approve_borrower_on_open_flow_loan()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
BEGIN
  IF new.borrower_user_id IS NULL OR public.get_loan_flow() <> 'open' THEN
    RETURN new;
  END IF;
  -- A request created on hold (awaiting their first call, or a current no-show) doesn't approve
  -- them: switching to the 'call' flow must not let in people who never attended.
  IF new.on_hold_since IS NOT NULL THEN
    RETURN new;
  END IF;

  UPDATE public.users
  SET loan_access_status = 'approved',
      loan_access_approved_at = now(),
      loan_access_seen_at = COALESCE(loan_access_seen_at, now())
  WHERE id = new.borrower_user_id
    AND loan_access_status <> 'approved';

  UPDATE public.loan_access_requests
  SET status = 'approved', decided_at = now(), decided_by = 'open-flow-loan'
  WHERE user_id = new.borrower_user_id
    AND status = 'pending';

  RETURN new;
END;
$$;

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
     -- Login provider ids (20261003010000): set by telegram-login / line-login / the bot. Client-writable,
     -- they let someone tag their account with another person's Telegram or LINE id.
     OR new.telegram_id IS DISTINCT FROM old.telegram_id
     OR new.line_id IS DISTINCT FROM old.line_id
  THEN
    RAISE EXCEPTION 'users: verification/credit columns can only be written by verified server-side code';
  END IF;

  RETURN new;
END;
$$;
