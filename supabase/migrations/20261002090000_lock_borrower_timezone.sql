-- A borrower's deadline is the end of their due day in their zone (20261001150000). That zone came
-- from users.timezone, which the client could set to anything (a direct update, or set_my_timezone),
-- so a Manila borrower could pick Pacific/Pago_Pago and gain ~19 hours (review, 2026-10-01).
--
-- 1) users.timezone / video_call_timezone become server-only columns: only set_my_timezone (security
--    definer) and the Cal.com functions write them.
-- 2) resolve_user_timezone trusts the device zone only when it is within 3 hours of the country the
--    borrower actually logs in from (3+ logins); otherwise it uses that country's zone.
-- 3) is_usable_timezone also rejects names JS Intl can't read (posix/, right/, Factory, ...), so the
--    database and the app always pick the same zone.

create or replace function app_private.is_usable_timezone(p_zone text)
returns boolean
language sql
stable
set search_path to ''
as $$
  select p_zone is not null
     and p_zone !~* '^(utc|gmt|etc/|zulu|universal|uct|posix|right/|factory|localtime|systemv/)'
     and p_zone ~ '^[A-Za-z]+/[A-Za-z0-9_+\-/]+$'
     and exists (select 1 from pg_catalog.pg_timezone_names where name = p_zone);
$$;

create or replace function app_private.resolve_user_timezone(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_device text;
  v_call text;
  v_country text;
  v_country_zone text;
  v_claimed text;
begin
  select u.timezone, u.video_call_timezone into v_device, v_call from public.users as u where u.id = p_user_id;

  select l.country_iso into v_country
  from public.auth_ip_log as l
  where l.user_id = p_user_id and l.country_iso is not null and not coalesce(l.is_hosting, false)
  group by l.country_iso
  having count(*) >= 3
  order by count(*) desc, max(l.last_seen_at) desc
  limit 1;
  v_country_zone := app_private.country_timezone(v_country);

  v_claimed := case
    when app_private.is_usable_timezone(v_device) then v_device
    when app_private.is_usable_timezone(v_call) then v_call
  end;

  if v_claimed is not null
     and (v_country_zone is null
          or abs(extract(epoch from (now() at time zone v_claimed) - (now() at time zone v_country_zone))) <= 3 * 3600) then
    return v_claimed;
  end if;

  return coalesce(v_country_zone, 'Asia/Manila');
end;
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
  THEN
    RAISE EXCEPTION 'users: verification/credit columns can only be written by verified server-side code';
  END IF;

  RETURN new;
END;
$$;
