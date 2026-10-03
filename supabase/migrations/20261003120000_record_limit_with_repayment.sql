-- Record a repaid loan's credit limit in the same update that marks it Paid.
--
-- confirm-loan-payment used to write loans.credit_limit_at_repayment in a separate update AFTER
-- record_loan_payment. But the sync_completed_trust_milestones_on_loans trigger fires on the update
-- that sets repayment_status = 'Paid', when the limit is still null, so is_trust_milestone_complete
-- replayed the loan from the $15 start. A borrower at $20 (e.g. via a referral) repaying a $15
-- trust-building loan on time was awarded "Repay a full-limit loan" and its points. Completions are
-- insert-only, so the wrong award stuck.
--
-- Only the repay branch changes. confirm-loan-payment's later write is guarded by
-- `credit_limit_at_repayment is null`, so it becomes a no-op.

create or replace function public.record_loan_payment(
  p_loan_id uuid,
  p_action text,
  p_caller uuid,
  p_spend_hashes text[],
  p_record_hash text,
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
  v_record text := lower(p_record_hash);
  v_hash text;
  v_paid numeric := p_amount_micros / 1000000.0;
  v_remaining numeric;
  v_new_repaid numeric;
  v_full boolean;
  v_overpaid_micros bigint := 0;
  v_limit integer;
begin
  if p_spend_hashes is null or cardinality(p_spend_hashes) = 0 then
    return jsonb_build_object('error', 'no_hash');
  end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

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

  begin
    foreach v_hash in array (select array_agg(distinct lower(h)) from unnest(p_spend_hashes) as h) loop
      insert into public.used_payment_hashes (hash, loan_id) values (v_hash, p_loan_id);
    end loop;
  exception when unique_violation then
    return jsonb_build_object('error', 'hash_used');
  end;

  if p_action = 'fund' then
    update public.loans
       set hash = coalesce(hash, '{}'::text[]) || v_record,
           lender_user_id = p_caller,
           lender_wallet = lower(p_from),
           loan_status = 'Lent'::public.loan_status,
           funded_at = now(),
           on_hold_since = null,
           on_hold_reason = null
     where id = p_loan_id
     returning * into v_loan;
  elsif p_action = 'repay' then
    v_remaining := greatest(v_loan.total_repayment_amount - coalesce(v_loan.repaid_amount, 0), 0);
    if v_paid > v_remaining then
      v_overpaid_micros := round((v_paid - v_remaining) * 1000000);
    end if;
    v_new_repaid := least(coalesce(v_loan.repaid_amount, 0) + v_paid, v_loan.total_repayment_amount);
    v_full := v_new_repaid >= v_loan.total_repayment_amount - 0.005;
    -- The limit this loan is measured against (full-limit vs trust-building), recorded in the SAME
    -- update that marks it Paid: the milestone trigger fires on that update, and with no recorded limit
    -- it would replay the loan from $15 and could award "full-limit" for a trust-building loan.
    -- Same as confirm-loan-payment's getEffectiveCreditLimit; unverified borrowers get none.
    if v_full and v_loan.credit_limit_at_repayment is null then
      select case when u.is_world_id::text = 'ACTIVE' or u.is_didit::text = 'ACTIVE'
                  then least(greatest(coalesce(u.cs, 0), 15), 140) end
        into v_limit
        from public.users as u
       where u.id = v_loan.borrower_user_id;
    end if;
    update public.loans
       set hash = coalesce(hash, '{}'::text[]) || v_record,
           repaid_amount = case when v_full then total_repayment_amount else v_new_repaid end,
           repayment_status = (case when v_full then 'Paid' else 'Partial' end)::public.repayment_status,
           repaid_at = case when v_full then now() else repaid_at end,
           credit_limit_at_repayment = coalesce(credit_limit_at_repayment, v_limit)
     where id = p_loan_id
     returning * into v_loan;
  else
    update public.loans
       set interest_returned_at = now(),
           interest_return_hash = v_record
     where id = p_loan_id
     returning * into v_loan;
  end if;

  return jsonb_build_object('loan', to_jsonb(v_loan), 'overpaid_micros', v_overpaid_micros);
end;
$$;

revoke all on function public.record_loan_payment(uuid, text, uuid, text[], text, bigint, text) from public, anon, authenticated;
grant execute on function public.record_loan_payment(uuid, text, uuid, text[], text, bigint, text) to service_role;
