-- Security review, 2026-10-02.
--
-- 1) One payment could be counted many times. used_payment_hashes compared the hash exactly, but Base
--    reads a hash in any letter case, so the same transfer resubmitted in capitals passed. And a Base
--    Account payment only registered its userOperation hash, so resubmitting the real transaction hash
--    (stored on loans.hash, readable by anyone) counted it again. Hashes are now stored lowercase, both
--    the submitted hash and the real transaction hash are registered, and every hash already on a loan
--    is registered too.
-- 2) Recording a payment was "mark hash used" then "update loan" as separate writes, with the loan's
--    state read before a slow on-chain check: two partial repayments at once lost one, two lenders
--    funding at once both "won", and a failed loan update left the hash burned. public.record_loan_payment
--    does it in one transaction under a row lock (service role only; called by confirm-loan-payment).
-- 3) A new account created its own users row from the browser and only UPDATEs were guarded, so it
--    could insert itself already verified, approved, with a $140 limit. New rows from clients now get
--    every server-only column reset to its default.
-- 4) New loan requests: the repayment total can't be below the amount borrowed, and the columns only
--    the server sets (repayment-limit record, refund fields) start empty.
-- 5) Data fix: three real loans repaid before loans.repaid_at existed get their real repayment time
--    from the chain, so on-time points and milestones judge the real date instead of a July 18 bulk edit.

-- 1) Payment hashes: lowercase, one format, and everything already used on a loan registered.
create or replace function app_private.normalize_used_payment_hash()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.hash := lower(new.hash);
  return new;
end;
$$;

drop trigger if exists trg_normalize_used_payment_hash on public.used_payment_hashes;
create trigger trg_normalize_used_payment_hash
  before insert or update on public.used_payment_hashes
  for each row execute function app_private.normalize_used_payment_hash();

update public.used_payment_hashes set hash = lower(hash) where hash <> lower(hash);

alter table public.used_payment_hashes drop constraint if exists used_payment_hashes_hash_format;
alter table public.used_payment_hashes
  add constraint used_payment_hashes_hash_format check (hash ~ '^0x[0-9a-f]{64}$');

insert into public.used_payment_hashes (hash, loan_id)
select distinct on (lower(h)) lower(h), l.id
  from public.loans as l, unnest(l.hash) as h
 where lower(h) ~ '^0x[0-9a-f]{64}$'
 order by lower(h), l.funded_at nulls last
on conflict (hash) do nothing;

insert into public.used_payment_hashes (hash, loan_id)
select lower(x.h), x.id
  from (
    select l.id, l.interest_return_hash as h from public.loans as l
    union all
    select l.id, l.refund_hash from public.loans as l
  ) as x
 where x.h is not null and lower(x.h) ~ '^0x[0-9a-f]{64}$'
on conflict (hash) do nothing;

-- 2) Record a verified payment in one locked transaction.
create or replace function public.record_loan_payment(
  p_loan_id uuid,
  p_action text,
  p_caller uuid,
  p_input_hash text,
  p_tx_hash text,
  p_amount_micros bigint,
  p_from text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans;
  v_input text := lower(p_input_hash);
  v_tx text := lower(coalesce(nullif(p_tx_hash, ''), p_input_hash));
  v_new_repaid numeric;
  v_full boolean;
begin
  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  -- The state is re-checked here, under the lock: the edge function's own checks ran before the slow
  -- on-chain verification and can be stale.
  if p_action = 'fund' then
    if v_loan.loan_status::text <> 'Requested' or v_loan.lender_user_id is not null then
      return jsonb_build_object('error', 'not_open');
    end if;
  elsif p_action = 'repay' then
    if v_loan.loan_status::text <> 'Lent' or coalesce(v_loan.repayment_status::text, '') = 'Paid' then
      return jsonb_build_object('error', 'not_awaiting_repayment');
    end if;
  elsif p_action = 'return-interest' then
    if coalesce(v_loan.repayment_status::text, '') <> 'Paid' or v_loan.interest_returned_at is not null then
      return jsonb_build_object('error', 'interest_not_returnable');
    end if;
  else
    return jsonb_build_object('error', 'bad_action');
  end if;

  -- Both the submitted hash and the real transaction hash are spent together.
  begin
    insert into public.used_payment_hashes (hash, loan_id) values (v_input, p_loan_id);
    if v_tx <> v_input then
      insert into public.used_payment_hashes (hash, loan_id) values (v_tx, p_loan_id);
    end if;
  exception when unique_violation then
    return jsonb_build_object('error', 'hash_used');
  end;

  if p_action = 'fund' then
    update public.loans
       set hash = coalesce(hash, '{}'::text[]) || v_tx,
           lender_user_id = p_caller,
           lender_wallet = lower(p_from),
           loan_status = 'Lent'::public.loan_status,
           funded_at = now(),
           on_hold_since = null,
           on_hold_reason = null
     where id = p_loan_id
     returning * into v_loan;
  elsif p_action = 'repay' then
    v_new_repaid := least(coalesce(v_loan.repaid_amount, 0) + p_amount_micros / 1000000.0, v_loan.total_repayment_amount);
    v_full := v_new_repaid >= v_loan.total_repayment_amount - 0.005;
    update public.loans
       set hash = coalesce(hash, '{}'::text[]) || v_tx,
           repaid_amount = case when v_full then total_repayment_amount else v_new_repaid end,
           repayment_status = (case when v_full then 'Paid' else 'Partial' end)::public.repayment_status,
           repaid_at = case when v_full then now() else repaid_at end
     where id = p_loan_id
     returning * into v_loan;
  else
    update public.loans
       set interest_returned_at = now(),
           interest_return_hash = v_tx
     where id = p_loan_id
     returning * into v_loan;
  end if;

  return jsonb_build_object('loan', to_jsonb(v_loan));
end;
$$;

revoke all on function public.record_loan_payment(uuid, text, uuid, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_loan_payment(uuid, text, uuid, text, text, bigint, text) to service_role;

-- 3) New users rows from the browser can't set any server-only column.
create or replace function app_private.reset_user_privileged_columns_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  new.is_world_id := 'INACTIVE';
  new.is_didit := 'INACTIVE';
  new.is_veriff := 'INACTIVE';
  new.didit_id_status := null;
  new.liveness_status := null;
  new.liveness_session_id := null;
  new.nullifier_hash := null;
  new.cs := 15;
  new.mal := 3;
  new.nal := 0;
  new.credit_progression_paused := false;
  new.current_risk_score := null;
  new.current_risk_band := null;
  new.risk_computed_at := null;
  new.account_status := 'active';
  new.wallet_face_status := null;
  new.wallet_face_session_id := null;
  new.wallet_face_checked_at := null;
  new.cashout_gate_exempt := false;
  new.whatsapp_verified_at := null;
  new.messenger_verified_at := null;
  new.messenger_psid := null;
  new.messenger_stuck_alerted_at := null;
  new.loan_access_status := 'none';
  new.loan_access_approved_at := null;
  new.video_call_scheduled_at := null;
  new.video_call_starts_at := null;
  new.video_call_host := null;
  new.video_call_booking_uid := null;
  new.video_call_reminder_stage := 0;
  new.video_call_confirm_token := null;
  new.video_call_confirmed_at := null;
  new.video_call_outcome := null;
  new.video_call_outcome_at := null;
  new.video_call_join_url := null;
  new.video_call_meeting_id := null;
  new.video_call_arrived_at := null;
  new.video_call_joined_at := null;
  new.video_call_left_at := null;
  new.video_call_keep_spot_asked_at := null;
  new.video_call_timezone := null;
  new.redeemed_referral_code_id := null;
  new.referral_boost_amount := null;
  new.timezone := null;
  return new;
end;
$$;

drop trigger if exists trg_reset_user_privileged_columns_on_insert on public.users;
create trigger trg_reset_user_privileged_columns_on_insert
  before insert on public.users
  for each row execute function app_private.reset_user_privileged_columns_on_insert();

-- 4) New loan requests from the browser: sane terms, server-only columns empty. (Status, money,
--    funding and the credit limit are already enforced by enforce_borrower_credit_limits.)
create or replace function app_private.enforce_new_loan_terms()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.total_repayment_amount is null or new.total_repayment_amount < new.loan_amount then
    raise exception 'loans: the repayment total can''t be less than the amount borrowed';
  end if;
  new.credit_limit_at_repayment := null;
  new.refunded_at := null;
  new.refund_reason := null;
  new.refunded_by := null;
  new.refund_hash := null;
  new.offplatform_settlement_note := null;
  return new;
end;
$$;

drop trigger if exists trg_enforce_new_loan_terms on public.loans;
create trigger trg_enforce_new_loan_terms
  before insert on public.loans
  for each row execute function app_private.enforce_new_loan_terms();

-- 5) Real repayment times from the chain (tx block timestamps on Base).
update public.loans set repaid_at = '2026-03-30 22:36:09+00', updated_at = now()
 where tracking_id = 'LOAN-1773302934952-chkklrd' and repaid_at is null;
update public.loans set repaid_at = '2026-05-01 13:56:09+00', updated_at = now()
 where tracking_id = 'LOAN-1775095207097-liqi6x9' and repaid_at is null;
update public.loans set repaid_at = '2026-06-17 15:01:27+00', updated_at = now()
 where tracking_id = 'LOAN-1780277573451-qk3spvg' and repaid_at is null;
