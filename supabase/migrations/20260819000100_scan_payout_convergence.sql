-- Convergence detection over loan_fund_flow (Part A, step 3).
--
-- The 2026-08-15 signature: one external destination (a Coins.ph deposit address) fed by
-- the loans of two+ DISTINCT borrower accounts. Because Coins.ph issues one deposit address
-- per user, that means one beneficiary behind multiple "borrowers" — a mule herder. This
-- scan emits that as a critical signal, plus a warning when funds hit an exchange within a
-- few hours of funding (bust-out speed). Same jsonb shape, same fraud_signal_alerts dedup,
-- and the same alert path as scan_wallet_fraud_signals — no new alerting channel.

create or replace function public.scan_payout_convergence(fast_offramp_hours integer default 24)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_signals jsonb := '[]'::jsonb;
  rec record;
  key text;
begin
  -- A. One destination, many borrowers — the herder signature. Critical.
  for rec in
    select f.terminal_destination,
           max(f.destination_label)                       as label,
           bool_or(f.is_exchange_deposit)                 as is_exchange,
           count(distinct f.borrower_user_id)             as borrower_count,
           jsonb_agg(distinct jsonb_build_object(
             'user_id', f.borrower_user_id,
             'username', u.username,
             'loan_id', f.loan_id))                       as accounts
    from public.loan_fund_flow f
    left join public.users u on u.id = f.borrower_user_id
    where f.borrower_user_id is not null
    group by f.terminal_destination
    having count(distinct f.borrower_user_id) > 1
  loop
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'shared_payout_destination' and a.subject_key = rec.terminal_destination) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('shared_payout_destination', rec.terminal_destination,
              jsonb_build_object('terminal_destination', rec.terminal_destination,
                                 'destination_label', rec.label,
                                 'is_exchange_deposit', rec.is_exchange,
                                 'borrower_count', rec.borrower_count,
                                 'accounts', rec.accounts));
      new_signals := new_signals || jsonb_build_object(
        'type', 'shared_payout_destination', 'severity', 'critical',
        'terminal_destination', rec.terminal_destination,
        'destination_label', rec.label,
        'is_exchange_deposit', rec.is_exchange,
        'account_count', rec.borrower_count,
        'accounts', rec.accounts);
    end if;
  end loop;

  -- B. Fast off-ramp — loan funds reached an exchange deposit within N hours of funding.
  for rec in
    select f.loan_id, f.terminal_destination, f.destination_label,
           f.borrower_user_id, u.username,
           extract(epoch from (f.first_out_at - f.funded_at)) / 3600.0 as hours_to_offramp
    from public.loan_fund_flow f
    left join public.users u on u.id = f.borrower_user_id
    where f.is_exchange_deposit
      and f.funded_at is not null and f.first_out_at is not null
      and f.first_out_at <= f.funded_at + make_interval(hours => fast_offramp_hours)
  loop
    key := rec.loan_id::text || ':' || rec.terminal_destination;
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'fast_offramp' and a.subject_key = key) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('fast_offramp', key,
              jsonb_build_object('loan_id', rec.loan_id, 'terminal_destination', rec.terminal_destination,
                                 'destination_label', rec.destination_label,
                                 'hours_to_offramp', round(rec.hours_to_offramp::numeric, 2)));
      new_signals := new_signals || jsonb_build_object(
        'type', 'fast_offramp', 'severity', 'warning',
        'loan_id', rec.loan_id,
        'user_id', rec.borrower_user_id, 'username', rec.username,
        'destination_label', rec.destination_label,
        'hours_apart', round(rec.hours_to_offramp::numeric, 2));
    end if;
  end loop;

  return jsonb_build_object(
    'generated_at', now(),
    'new_signal_count', jsonb_array_length(new_signals),
    'signals', new_signals);
end;
$$;

revoke all on function public.scan_payout_convergence(integer) from public;
grant execute on function public.scan_payout_convergence(integer) to service_role, postgres;
