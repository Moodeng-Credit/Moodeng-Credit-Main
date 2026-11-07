-- Indonesia track: asking for a loan inside Telegram (docs/INDONESIA_TRACK.md "Living in Telegram").
--
--   The bot (telegram-webhook → _shared/idBot.ts) walks an Indonesian through amount → term → rupiah
--   total → purpose → confirm, then calls public.bot_request_id_loan() with the service role.
--
--   Why a function and not a plain insert: a service-role insert skips every client check —
--   app_private.enforce_new_loan_terms and enforce_new_loan_terms' peg pricing return early unless
--   current_user is authenticated/anon, public.enforce_borrower_credit_limits and
--   app_private.enforce_borrower_role_on_loan return early unless the JWT role is authenticated/anon,
--   and the "Authenticated users can create loans" RLS policy (repost cooldown) doesn't apply. So this
--   function does ALL of those checks itself, in one transaction, with the borrower row locked (two taps
--   on Confirm serialize; the second sees the first request and is refused).
--
--   Everything that runs on ANY insert still runs: set_loan_market (→ 'ID'), set_loan_due_timezone,
--   hold_request_until_first_call, keep_is_test_server_only, notify_loan_request_telegram (team post +
--   loan-request-telegram-notification, which sends the borrower's "loan posted"), risk scoring,
--   approve_borrower_on_open_flow_loan, the make.com hooks. Autopay (id_autopay) picks the request up
--   from the 5-minute job like any other Indonesian request.
--
--   Returns {ok:true, loan:{…}} or {ok:false, error:'<code>', …} — never raises for a rule, so the bot
--   can say what's wrong in Bahasa.

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
  if v_user.walt_address is null then return jsonb_build_object('ok', false, 'error', 'no_walt'); end if;
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

revoke all on function public.bot_request_id_loan(uuid, numeric, integer, numeric, text) from public, anon, authenticated;
grant execute on function public.bot_request_id_loan(uuid, numeric, integer, numeric, text) to service_role;

-- Repayments sent from Walt straight to the lender through Relay (_shared/idRepayments.ts) look the
-- open rows up by loan.
create index if not exists relay_transfers_loan_idx on public.relay_transfers (loan_id, created_at desc) where loan_id is not null;
create index if not exists relay_transfers_open_repay_idx on public.relay_transfers (created_at)
  where direction = 'repay' and status in ('quoted', 'sent', 'pending');

-- Base addresses Relay fills from (comma separated), for the fallback match when Relay's status API
-- can't follow a deposit of a different amount. Learned addresses from verified fills are added to it
-- at run time; this seed is only a starting point.
insert into public.telegram_bot_settings (key, value, description) values
  ('relay_base_solvers', '0xf70da97812cb96acdf810712aa562db8dfa3dbef',
   'Relay solver addresses on Base (comma separated). Used only by the Walt→lender repay fallback match (_shared/idRepayments.ts).')
on conflict (key) do nothing;
