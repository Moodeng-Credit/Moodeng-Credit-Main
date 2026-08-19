-- Convergence false-positive filters (applied to prod 2026-08-19 during backfill; this is
-- the repo record). Two classes of noise showed up in the first live backfill:
--   1. DeFi contracts (DEX routers/pools/bridges) — money going INTO DeFi is not a mule
--      off-ramp, and a popular router is hit by many unrelated borrowers (false convergence).
--   2. Internal test accounts (users.is_test) — inflate borrower counts.
-- classified the 11 seed contracts via eth_getCode (batched RPC).

-- Ignore-list for convergence detection.
create table if not exists public.flow_ignore_destinations (
  address    text primary key,
  reason     text not null default 'contract',
  created_at timestamptz not null default now()
);
alter table public.flow_ignore_destinations enable row level security;
drop policy if exists "admins read flow ignore" on public.flow_ignore_destinations;
create policy "admins read flow ignore" on public.flow_ignore_destinations
  for select to authenticated using (app_private.is_moodeng_admin());

insert into public.flow_ignore_destinations (address, reason) values
  ('0x0a2854fbbd9b3ef66f17d47284e7f899b9509330','contract'),
  ('0x15c3999a6e00aeb2dc41a82b894b5c81cafe7c89','contract'),
  ('0x498581ff718922c3f8e6a244956af099b2652b2b','contract'),
  ('0x56c8989222ed293e3c4a22628d8bca633ce1eb99','contract'),
  ('0x5badb0143f69015c5c86cbd9373474a9c8ab713b','contract'),
  ('0x69522fb5337663d3b4dfb0030b881c1a750adb4f','contract'),
  ('0x6c561b446416e1a00e8e93e221854d6ea4171372','contract'),
  ('0x757f8c2b547fd208e9b4b998eb08c5359d6699b0','contract'),
  ('0x7747f8d2a76bd6345cc29622a946a929647f2359','contract'),
  ('0x98cfe0c87264e8181a563892f809df5c9778cacc','contract'),
  ('0xb4cb800910b228ed3d0834cf79d697127bbb00e5','contract')
on conflict (address) do nothing;

-- Updated convergence scan: exclude ignore-list destinations and TEST users. A destination
-- must be fed by >=2 distinct NON-TEST borrowers to fire.
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
  -- A. One destination, many real borrowers — the herder signature. Critical.
  for rec in
    select f.terminal_destination,
           max(f.destination_label)                                            as label,
           bool_or(f.is_exchange_deposit)                                      as is_exchange,
           count(distinct f.borrower_user_id) filter (where not coalesce(u.is_test,false)) as borrower_count,
           jsonb_agg(distinct jsonb_build_object('user_id', f.borrower_user_id, 'username', u.username, 'loan_id', f.loan_id))
             filter (where not coalesce(u.is_test,false))                      as accounts
    from public.loan_fund_flow f
    left join public.users u on u.id = f.borrower_user_id
    where f.borrower_user_id is not null
      and f.terminal_destination not in (select address from public.flow_ignore_destinations)
    group by f.terminal_destination
    having count(distinct f.borrower_user_id) filter (where not coalesce(u.is_test,false)) > 1
  loop
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'shared_payout_destination' and a.subject_key = rec.terminal_destination) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('shared_payout_destination', rec.terminal_destination,
              jsonb_build_object('terminal_destination', rec.terminal_destination, 'destination_label', rec.label,
                                 'is_exchange_deposit', rec.is_exchange, 'borrower_count', rec.borrower_count, 'accounts', rec.accounts));
      new_signals := new_signals || jsonb_build_object(
        'type', 'shared_payout_destination', 'severity', 'critical',
        'terminal_destination', rec.terminal_destination, 'destination_label', rec.label,
        'is_exchange_deposit', rec.is_exchange, 'account_count', rec.borrower_count, 'accounts', rec.accounts);
    end if;
  end loop;

  -- B. Fast off-ramp — loan funds reached an exchange deposit within N hours of funding.
  for rec in
    select f.loan_id, f.terminal_destination, f.destination_label, f.borrower_user_id, u.username,
           extract(epoch from (f.first_out_at - f.funded_at)) / 3600.0 as hours_to_offramp
    from public.loan_fund_flow f
    left join public.users u on u.id = f.borrower_user_id
    where f.is_exchange_deposit and not coalesce(u.is_test,false)
      and f.funded_at is not null and f.first_out_at is not null
      and f.first_out_at <= f.funded_at + make_interval(hours => fast_offramp_hours)
  loop
    key := rec.loan_id::text || ':' || rec.terminal_destination;
    if not exists (select 1 from public.fraud_signal_alerts a
                   where a.signal_type = 'fast_offramp' and a.subject_key = key) then
      insert into public.fraud_signal_alerts (signal_type, subject_key, details)
      values ('fast_offramp', key,
              jsonb_build_object('loan_id', rec.loan_id, 'terminal_destination', rec.terminal_destination,
                                 'destination_label', rec.destination_label, 'hours_to_offramp', round(rec.hours_to_offramp::numeric, 2)));
      new_signals := new_signals || jsonb_build_object(
        'type', 'fast_offramp', 'severity', 'warning', 'loan_id', rec.loan_id,
        'user_id', rec.borrower_user_id, 'username', rec.username,
        'destination_label', rec.destination_label, 'hours_apart', round(rec.hours_to_offramp::numeric, 2));
    end if;
  end loop;

  return jsonb_build_object('generated_at', now(), 'new_signal_count', jsonb_array_length(new_signals), 'signals', new_signals);
end;
$$;

revoke all on function public.scan_payout_convergence(integer) from public;
grant execute on function public.scan_payout_convergence(integer) to service_role, postgres;
