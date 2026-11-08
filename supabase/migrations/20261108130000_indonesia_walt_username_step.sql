-- Indonesia track: the Walt step without an address (docs/INDONESIA_TRACK.md "Hand-holding").
--
-- Loans now go out by Walt Transfer to the borrower's Telegram @username (20261108120000), so step 7 no
-- longer asks a first-time user to find and paste a BNB Smart Chain deposit address. Instead: open Walt
-- once (so it can receive) + have a Telegram @username. The server (stableyard-deposit-address action
-- id_walt_ready, _shared/idWaltPayouts.ts markWaltReady) reads the @username from Telegram itself
-- (getChat) and sets users.walt_ready_at; clients can't write it.
--
-- The Walt step counts as done with EITHER the old address OR walt_ready_at + a username. The three
-- checks that required walt_address now accept that too (bodies copied from their latest versions —
-- 20261107120000, 20261107170000, 20261107190000 — with only that check changed). The payout wallet
-- (chain mode) still needs an address: claim_id_auto_payout refuses without one, as before.

alter table public.users add column if not exists walt_ready_at timestamptz;
comment on column public.users.walt_ready_at is 'Indonesia track: borrower opened Walt and has a Telegram @username (loans go by Walt Transfer to it). Server-set only.';

-- Payout rows for Walt Transfer loans have no address.
alter table public.id_manual_payouts alter column walt_address drop not null;

create or replace function app_private.reset_id_track_columns_on_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.market := null;
    new.market_set_at := null;
    new.facebook_profile_url := null;
    new.facebook_page_followed_at := null;
    new.walt_address := null;
    new.walt_address_set_at := null;
    new.walt_ready_at := null;
    new.id_nudge_count := 0;
    new.id_nudged_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.id_onboarding_status(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with u as (select * from public.users where id = p_user_id),
  doc as (
    select d.decision, d.verdict, d.created_at
    from public.income_documents d where d.user_id = p_user_id
    order by d.created_at desc limit 1
  ),
  s as (
    select
      u.market,
      u.chat_id is not null as telegram,
      coalesce(u.whatsapp_verified_at is not null and regexp_replace(coalesce(u.whatsapp_number, ''), '\D', '', 'g') like '62%', false) as whatsapp,
      (u.messenger_verified_at is not null and u.facebook_profile_url is not null and u.facebook_page_followed_at is not null) as facebook,
      (u.messenger_verified_at is not null) as messenger,
      (u.facebook_profile_url is not null and u.facebook_page_followed_at is not null) as facebook_profile,
      (u.income_type is not null) as about,
      exists (select 1 from doc where doc.decision is distinct from 'declined'
                                  and (doc.decision = 'approved' or doc.verdict is distinct from 'resend')) as income,
      coalesce((select doc.decision from doc), case when (select doc.verdict from doc) = 'resend' then 'resend' end) as income_state,
      coalesce(u.is_didit = 'ACTIVE', false) as kyc_approved,
      coalesce(u.is_didit = 'ACTIVE'
        or lower(coalesce(u.didit_id_status, '')) like '%review%'
        or (u.didit_submitted_at is not null
            and lower(coalesce(u.didit_id_status, '')) not in ('duplicate', 'declined', 'abandoned', 'expired', 'not started', 'in progress')), false) as kyc,
      lower(coalesce(u.didit_id_status, '')) as kyc_state,
      (u.walt_address is not null or (u.walt_ready_at is not null and nullif(trim(coalesce(u.telegram_username, '')), '') is not null)) as walt,
      coalesce(u.loan_access_status in ('pending', 'approved'), false) as call,
      coalesce(u.loan_access_status, 'none') as access
    from u
  )
  select case when s.market is distinct from 'ID' then jsonb_build_object('market', null)
  else jsonb_build_object(
    'market', 'ID',
    'steps', jsonb_build_object(
      'telegram', s.telegram, 'whatsapp', s.whatsapp, 'facebook', s.facebook, 'about', s.about,
      'income', s.income, 'kyc', s.kyc, 'walt', s.walt, 'call', s.call),
    'messenger', s.messenger,
    'facebookProfile', s.facebook_profile,
    'incomeState', s.income_state,
    'kycApproved', s.kyc_approved,
    'kycState', s.kyc_state,
    'access', s.access,
    -- KYC can start once everything before it is done.
    'readyForKyc', s.telegram and s.whatsapp and s.facebook and s.about and s.income,
    -- The call can be booked once everything before it is done (KYC submitted is enough to book;
    -- the team only ✅s once KYC is approved).
    'readyForCall', s.telegram and s.whatsapp and s.facebook and s.about and s.income and s.kyc and s.walt,
    'next', case
      when not s.telegram then 'telegram'
      when not s.whatsapp then 'whatsapp'
      when not s.facebook then 'facebook'
      when not s.about then 'about'
      when not s.income then 'income'
      when not s.kyc then 'kyc'
      when not s.walt then 'walt'
      when not s.call then 'call'
      when s.access = 'approved' then 'apply'
      else 'waiting' end)
  end
  from s;
$$;

create or replace function app_private.enforce_new_loan_terms()
returns trigger language plpgsql set search_path to '' as $function$
declare
  v_market text;
  v_access text;
  v_didit text;
  v_walt text;
  v_rules jsonb;
  v_max_days int;
  v_rate numeric;
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

create or replace function public.bot_request_id_loan(
  p_user_id uuid,
  p_amount numeric,
  p_days integer,
  p_repay_idr numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users;
  v_rules jsonb := public.get_id_loan_rules();
  v_max_days int := coalesce((v_rules ->> 'maxTermDays')::int, 14);
  v_rate numeric;
  v_total numeric;
  v_due timestamptz;
  v_reason text := left(trim(coalesce(p_reason, '')), 300);
  v_limit numeric;
  v_outstanding numeric;
  v_active int;
  v_deletes int;
  v_last_delete timestamptz;
  v_loan public.loans;
begin
  -- Lock the borrower: concurrent confirms (and an app request at the same moment) queue here, like
  -- enforce_borrower_credit_limits does.
  select * into v_user from public.users where id = p_user_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if v_user.market is distinct from 'ID' then return jsonb_build_object('ok', false, 'error', 'not_id_track'); end if;
  if coalesce(to_jsonb(v_user) ->> 'account_status', 'active') <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'account_closed');
  end if;
  -- enforce_borrower_role_on_loan
  if v_user.user_role::text = 'lender' then return jsonb_build_object('ok', false, 'error', 'lender'); end if;

  -- enforce_new_loan_terms (ID branch): approved after the call, KYC approved, Walt saved.
  if v_user.loan_access_status::text is distinct from 'approved' then
    return jsonb_build_object('ok', false, 'error', 'not_approved');
  end if;
  if v_user.is_didit::text is distinct from 'ACTIVE' then return jsonb_build_object('ok', false, 'error', 'kyc'); end if;
  if v_user.walt_address is null
     and (v_user.walt_ready_at is null or nullif(trim(coalesce(v_user.telegram_username, '')), '') is null) then
    return jsonb_build_object('ok', false, 'error', 'no_walt');
  end if;
  -- enforce_borrower_credit_limits: verified
  if not (v_user.is_didit::text = 'ACTIVE' or coalesce(v_user.is_world_id::text, '') = 'ACTIVE') then
    return jsonb_build_object('ok', false, 'error', 'not_verified');
  end if;

  -- Amount, term, rupiah total.
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2)
     or not exists (select 1 from jsonb_array_elements_text(v_rules -> 'amounts') a where a::numeric = p_amount) then
    return jsonb_build_object('ok', false, 'error', 'bad_amount', 'amounts', v_rules -> 'amounts');
  end if;
  if p_days is null or p_days < 1 or p_days > v_max_days then
    return jsonb_build_object('ok', false, 'error', 'bad_days', 'maxTermDays', v_max_days);
  end if;
  if p_repay_idr is null or p_repay_idr <= 0 or p_repay_idr <> trunc(p_repay_idr) or mod(p_repay_idr, 500) <> 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_repay_step');
  end if;
  v_rate := public.current_usd_idr();
  if v_rate is null then return jsonb_build_object('ok', false, 'error', 'no_rate'); end if;
  v_total := round(p_repay_idr / v_rate, 2);
  if v_total < p_amount + 1 then
    return jsonb_build_object('ok', false, 'error', 'repay_low', 'usd', v_total, 'rate', v_rate);
  end if;
  if v_total > p_amount * 1.5 then
    return jsonb_build_object('ok', false, 'error', 'repay_high', 'usd', v_total, 'rate', v_rate);
  end if;
  if length(v_reason) < 2 then return jsonb_build_object('ok', false, 'error', 'bad_reason'); end if;

  -- Due: midnight UTC of the Jakarta date + p_days (what the app's date picker sends).
  v_due := (((now() at time zone 'Asia/Jakarta')::date + p_days)::timestamp) at time zone 'UTC';
  if v_due > now() + make_interval(days => v_max_days + 1) then
    return jsonb_build_object('ok', false, 'error', 'bad_days', 'maxTermDays', v_max_days);
  end if;

  -- enforce_borrower_credit_limits: open requests (< 7 days) + funded-not-repaid count against the limit.
  select coalesce(sum(l.loan_amount), 0), count(*)
    into v_outstanding, v_active
    from public.loans l
   where l.borrower_user_id = p_user_id
     and ((l.loan_status::text = 'Requested' and l.created_at > now() - interval '7 days')
          or (l.loan_status::text = 'Lent' and l.repayment_status::text is distinct from 'Paid'));
  -- One at a time in Telegram: no new request while one is open or unpaid.
  if v_active > 0 then return jsonb_build_object('ok', false, 'error', 'has_open_loan'); end if;
  if coalesce(v_user.mal, 0) > 0 and v_active >= v_user.mal then
    return jsonb_build_object('ok', false, 'error', 'mal_reached');
  end if;
  v_limit := least(greatest(coalesce(v_user.cs, 0), 15), 140);
  if v_outstanding + p_amount > v_limit then
    return jsonb_build_object('ok', false, 'error', 'over_limit', 'limit', v_limit, 'inUse', v_outstanding);
  end if;

  -- Repost cooldown (get_loan_request_repost_status, keyed on this borrower instead of auth.uid()):
  -- 2+ deleted requests in 24 h and the last one under 30 min ago → wait.
  select count(*)::int, max(e.deleted_at) into v_deletes, v_last_delete
    from public.loan_request_delete_events e
   where e.borrower_user_id = p_user_id and e.deleted_at > now() - interval '24 hours';
  if v_deletes >= 2 and v_last_delete > now() - interval '30 minutes' then
    return jsonb_build_object('ok', false, 'error', 'cooldown', 'until', v_last_delete + interval '30 minutes');
  end if;

  -- The same columns loanSlice.createLoan sends, plus the peg columns enforce_new_loan_terms would set.
  -- due_timezone is overwritten by trg_set_loan_due_timezone (resolve_user_timezone) like for the app.
  insert into public.loans (
    tracking_id, borrower_user_id, borrower_wallet, lender_user_id, loan_amount, total_repayment_amount,
    reason, due_date, due_timezone, coin, repay_idr, fx_rate_at_request, usd_total_at_request, repaid_idr
  ) values (
    'LOAN-' || (extract(epoch from clock_timestamp()) * 1000)::bigint || '-' || substr(md5(random()::text || p_user_id::text), 1, 7),
    p_user_id, v_user.wallet_address, null, p_amount, v_total,
    v_reason, v_due, 'Asia/Jakarta', 'USDC', p_repay_idr, v_rate, v_total, 0
  )
  returning * into v_loan;

  return jsonb_build_object('ok', true, 'loan', jsonb_build_object(
    'id', v_loan.id,
    'tracking_id', v_loan.tracking_id,
    'loan_amount', v_loan.loan_amount,
    'repay_idr', v_loan.repay_idr,
    'total_repayment_amount', v_loan.total_repayment_amount,
    'due_date', v_loan.due_date,
    'market', v_loan.market,
    'on_hold_reason', v_loan.on_hold_reason));
end;
$$;

-- Clients can't set walt_ready_at, and an Indonesia-track borrower's Telegram @username (where their loans
-- are sent) only changes server-side (from Telegram itself: the bot / id_walt_ready).
create or replace function app_private.protect_id_walt_columns_on_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user::text);
begin
  if v_role in ('authenticated', 'anon') then
    new.walt_ready_at := old.walt_ready_at;
    if old.market = 'ID' then
      new.telegram_username := old.telegram_username;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_id_walt_columns_on_update on public.users;
create trigger trg_protect_id_walt_columns_on_update
  before update on public.users
  for each row execute function app_private.protect_id_walt_columns_on_update();

-- Payout cards: a reminder when one sits unpaid, and "⚠️ Not found in Walt" (the borrower is asked to
-- message Moodeng's account first, so Walt lists them).
alter table public.id_manual_payouts add column if not exists walt_card_reminded_at timestamptz;
alter table public.id_manual_payouts add column if not exists walt_not_found_at timestamptz;
