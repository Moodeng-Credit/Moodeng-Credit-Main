-- Phase 4a — real-time self-lending check at loan-funding time.
--
-- Today the wallet/IP scan is batch (00:45 UTC), so a self-funded loan isn't
-- caught until the next night — up to a ~24h blind spot on 3-day loans. This
-- fires the targeted overlap checks the instant a loan gets a lender, so a
-- 🔴 alert lands in seconds.
--
-- Detection ≠ punishment: this only alerts. The loan is never blocked (that is
-- Phase 6, gated on a separate founder decision).

-- ---------------------------------------------------------------------------
-- 1. Targeted overlap check for a single funded loan.
--    Returns the alert payload (jsonb) when a NEW finding is recorded, else null:
--      - null when the loan is not funded / incomplete,
--      - null when BOTH parties are whitelisted (mirrors scan blocks B–D),
--      - null when no overlap is found,
--      - null when this loan was already alerted (idempotent, one alert per loan).
-- ---------------------------------------------------------------------------
create or replace function public.check_loan_funding_overlap(p_loan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ip_window_days constant int := 14;
  v_loan   record;
  v_both_wl boolean;
  v_kinds  text[] := '{}';
  v_flag   boolean;
  v_details jsonb;
  v_rows   int;
begin
  select l.id,
         l.tracking_id,
         l.lender_user_id,
         l.borrower_user_id,
         lower(btrim(l.lender_wallet))   as lender_wallet,
         lower(btrim(l.borrower_wallet)) as borrower_wallet
    into v_loan
  from public.loans l
  where l.id = p_loan_id;

  if not found or v_loan.lender_user_id is null or v_loan.borrower_user_id is null then
    return null;  -- not funded yet / incomplete
  end if;

  -- Suppress only when EVERY involved account is whitelisted.
  select exists (select 1 from public.fraud_detection_whitelist where user_id = v_loan.lender_user_id)
     and exists (select 1 from public.fraud_detection_whitelist where user_id = v_loan.borrower_user_id)
    into v_both_wl;
  if v_both_wl then
    return null;
  end if;

  -- same account literally on both sides
  if v_loan.lender_user_id = v_loan.borrower_user_id then
    v_kinds := array_append(v_kinds, 'same_account');
  end if;

  -- identical wallet on both sides of this loan
  if v_loan.lender_wallet is not null and v_loan.borrower_wallet is not null
     and v_loan.lender_wallet = v_loan.borrower_wallet then
    v_kinds := array_append(v_kinds, 'same_wallet');
  end if;

  -- borrower & lender have used the same wallet at any point (history)
  select exists (
    select 1
    from public.wallet_usage_log wl
    join public.wallet_usage_log wb
      on lower(btrim(wl.wallet_address)) = lower(btrim(wb.wallet_address))
    where wl.user_id = v_loan.lender_user_id
      and wb.user_id = v_loan.borrower_user_id
  ) into v_flag;
  if v_flag then v_kinds := array_append(v_kinds, 'shared_wallet_history'); end if;

  -- shared login IP within the window
  select exists (
    select 1
    from public.auth_ip_log il
    join public.auth_ip_log ib on ib.ip_hash = il.ip_hash
    where il.user_id = v_loan.lender_user_id
      and ib.user_id = v_loan.borrower_user_id
      and il.last_seen_at >= now() - make_interval(days => ip_window_days)
      and ib.last_seen_at >= now() - make_interval(days => ip_window_days)
  ) into v_flag;
  if v_flag then v_kinds := array_append(v_kinds, 'shared_ip'); end if;

  -- shared /24 (/48) subnet within the window
  select exists (
    select 1
    from public.auth_ip_log il
    join public.auth_ip_log ib on ib.subnet_hash = il.subnet_hash
    where il.user_id = v_loan.lender_user_id
      and ib.user_id = v_loan.borrower_user_id
      and il.subnet_hash is not null
      and il.last_seen_at >= now() - make_interval(days => ip_window_days)
      and ib.last_seen_at >= now() - make_interval(days => ip_window_days)
  ) into v_flag;
  if v_flag then v_kinds := array_append(v_kinds, 'shared_subnet'); end if;

  -- same Telegram account
  select (lu.chat_id is not null and lu.chat_id = bu.chat_id)
    into v_flag
  from public.users lu, public.users bu
  where lu.id = v_loan.lender_user_id and bu.id = v_loan.borrower_user_id;
  if v_flag then v_kinds := array_append(v_kinds, 'same_chat_id'); end if;

  -- same canonical email (Gmail dot/plus normalized)
  select (app_private.canonical_email(lu.email) is not null
      and app_private.canonical_email(lu.email) = app_private.canonical_email(bu.email))
    into v_flag
  from public.users lu, public.users bu
  where lu.id = v_loan.lender_user_id and bu.id = v_loan.borrower_user_id;
  if v_flag then v_kinds := array_append(v_kinds, 'same_canonical_email'); end if;

  if array_length(v_kinds, 1) is null then
    return null;  -- clean loan
  end if;

  v_details := jsonb_build_object(
    'loan_id',          v_loan.id,
    'tracking_id',      v_loan.tracking_id,
    'lender_user_id',   v_loan.lender_user_id,
    'borrower_user_id', v_loan.borrower_user_id,
    'overlaps',         to_jsonb(v_kinds)
  );

  -- One alert per loan, ever (dedup on signal_type+subject_key).
  insert into public.fraud_signal_alerts (signal_type, subject_key, details)
  values ('realtime_funding_overlap', v_loan.id::text, v_details)
  on conflict (signal_type, subject_key) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return null;  -- already alerted for this loan
  end if;

  return v_details;
end;
$$;

revoke all on function public.check_loan_funding_overlap(uuid) from public;
revoke all on function public.check_loan_funding_overlap(uuid) from anon;
revoke all on function public.check_loan_funding_overlap(uuid) from authenticated;
grant execute on function public.check_loan_funding_overlap(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Trigger: on funding, call the edge function to run the check + dispatch.
--    Mirrors private.notify_loan_request_telegram (net.http_post + vault).
-- ---------------------------------------------------------------------------
create schema if not exists private;

create or replace function private.notify_loan_funding_fraud_check()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  project_url text;
  service_key text;
begin
  -- Fire only when a lender is (newly) assigned = the loan is funded.
  if new.lender_user_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.lender_user_id is not distinct from old.lender_user_id then
    return new;  -- lender didn't change
  end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key
  from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;

  if project_url is null or service_key is null then
    raise warning 'loan-funding fraud check skipped: Supabase project URL or secret key missing from vault.';
    return new;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/loan-funding-fraud-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object('loanId', new.id)
  );

  return new;
end;
$$;

revoke all on function private.notify_loan_funding_fraud_check() from public;
revoke all on function private.notify_loan_funding_fraud_check() from anon;
revoke all on function private.notify_loan_funding_fraud_check() from authenticated;

drop trigger if exists trigger_loan_funding_fraud_check on public.loans;
create trigger trigger_loan_funding_fraud_check
  after insert or update of lender_user_id on public.loans
  for each row
  execute function private.notify_loan_funding_fraud_check();
