-- Hotfix 2026-11-25: enforce_new_loan_terms (#1799) called app_private.fixed_loan_repayment, but the
-- trigger runs as the borrower ('authenticated'), which has no USAGE on app_private -> every PH loan
-- insert failed with 42501 (403, "Request wasn't saved"). Same rule, formula inlined. Applied live.

CREATE OR REPLACE FUNCTION app_private.enforce_new_loan_terms()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_market text;
  v_access text;
  v_didit text;
  v_walt text;
  v_rules jsonb;
  v_max_days int;
  v_rate numeric;
  v_days numeric;
  v_split boolean;
  v_fixed numeric;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  select u.market, u.loan_access_status, u.is_didit,
         coalesce(u.walt_address, case when (u.walt_ready_at is not null and nullif(trim(coalesce(u.telegram_username, '')), '') is not null) then 'walt:@' || u.telegram_username end)
    into v_market, v_access, v_didit, v_walt
  from public.users u where u.id = new.borrower_user_id;

  new.repaid_idr := 0;
  new.fx_alerted_at := null;
  new.usd_total_at_request := null;
  if v_market = 'ID' then
    if new.repay_idr is null then
      raise exception 'loans: choose how many rupiah you will repay';
    end if;
    if new.repay_idr <= 0 or new.repay_idr <> trunc(new.repay_idr) or mod(new.repay_idr, 500) <> 0 then
      raise exception 'loans: the rupiah repayment must be whole rupiah in steps of Rp 500';
    end if;
    v_rate := public.current_usd_idr();
    if v_rate is null then
      raise exception 'loans: no exchange rate right now, try again later';
    end if;
    new.fx_rate_at_request := v_rate;
    new.total_repayment_amount := round(new.repay_idr / v_rate, 2);
    new.usd_total_at_request := new.total_repayment_amount;
  else
    new.repay_idr := null;
    new.fx_rate_at_request := null;
  end if;

  if new.total_repayment_amount is null or new.total_repayment_amount < new.loan_amount then
    raise exception 'loans: the repayment total can''t be less than the amount borrowed';
  end if;
  if new.total_repayment_amount < new.loan_amount + 1 then
    raise exception 'loans: the repayment must be at least $1 more than the amount borrowed';
  end if;
  if new.loan_amount <> round(new.loan_amount, 2) or new.total_repayment_amount <> round(new.total_repayment_amount, 2) then
    raise exception 'loans: amounts must be in whole cents';
  end if;
  if new.due_date is null or new.due_date < now() - interval '2 days' or new.due_date > now() + interval '122 days' then
    raise exception 'loans: the repayment date must be between today and 120 days from now';
  end if;

  -- Philippines: 30 days, 10% on top (two-part loans 7.5%). Replaces the 20%-a-month cap (11-18).
  if v_market is distinct from 'ID' then
    v_days := extract(epoch from (new.due_date - now())) / 86400;
    v_split := new.repayment_schedule is not null
      and jsonb_typeof(new.repayment_schedule) = 'array'
      and jsonb_array_length(new.repayment_schedule) > 0;
    -- Inline: this trigger runs as the borrower, who can't use the app_private schema (#1799 broke every PH request).
    v_fixed := greatest(ceil(round(new.loan_amount * (1 + 0.1 * case when v_split then 0.75 else 1 end) * 1000000) / 10000) / 100, round(new.loan_amount + 1, 2));
    if v_days < 28 or v_days > 32 or new.total_repayment_amount <> v_fixed then
      raise exception 'loans: every loan is now 30 days with 10%% on top ($% back). Refresh the page and send it again.', to_char(v_fixed, 'FM999999990.00');
    end if;
  end if;

  if v_market = 'ID' then
    v_rules := public.get_id_loan_rules();
    v_max_days := (v_rules ->> 'maxTermDays')::int;
    if v_access is distinct from 'approved' or v_didit is distinct from 'ACTIVE' or v_walt is null then
      raise exception 'loans: finish your Indonesia onboarding and call before requesting a loan';
    end if;
    if not exists (select 1 from jsonb_array_elements_text(v_rules -> 'amounts') a where a::numeric = new.loan_amount) then
      raise exception 'loans: Indonesia loans can only be %', (select string_agg('$' || a, ' or ') from jsonb_array_elements_text(v_rules -> 'amounts') a);
    end if;
    if new.due_date > now() + make_interval(days => v_max_days + 1) then
      raise exception 'loans: Indonesia loans must be repaid within % days', v_max_days;
    end if;
    if new.total_repayment_amount > new.loan_amount * 1.5 then
      raise exception 'loans: the repayment can be at most 1.5× the amount borrowed';
    end if;
  end if;

  new.credit_limit_at_repayment := null;
  new.refunded_at := null;
  new.refund_reason := null;
  new.refunded_by := null;
  new.refund_hash := null;
  new.offplatform_settlement_note := null;
  return new;
end;
$function$;
