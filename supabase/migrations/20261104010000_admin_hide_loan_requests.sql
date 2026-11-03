-- Admin "Hide": take an open loan request off the board without deleting it.
--
-- Until now the admin Requests panel could only remove a request. Hiding reuses the request-hold
-- columns (loans.on_hold_since / on_hold_reason) that already keep a request away from lenders,
-- signed-out visitors, the board and the lender notifications, with a new reason: 'admin_hidden'.
-- Nothing is deleted, the borrower's row and history stay as they are, and an admin can put the
-- request back with one click.
--
-- 'admin_hidden' is deliberately not in any of the lists the video-call triggers clear
-- ('no_show', 'awaiting_call', 'rebooked'), so attending or rebooking a call never un-hides it.


-- 1) A review can be marked 'hidden' ----------------------------------------------------------------
alter table public.admin_loan_request_reviews
  drop constraint if exists admin_loan_request_reviews_status_check;
alter table public.admin_loan_request_reviews
  add constraint admin_loan_request_reviews_status_check
  check (status = any (array['needs_review', 'reported', 'duplicate', 'kept', 'deleted', 'hidden']::text[]));


-- 2) Hidden really means hidden ---------------------------------------------------------------------
-- The request hold is otherwise enforced in the app only: the public listing policy lets anyone with
-- the API key read every 'Requested' row. Leave admin-hidden rows out of it. The borrower still reads
-- their own request ("users read own loans") and admins still read everything.
drop policy if exists "public loan listings are readable" on public.loans;
create policy "public loan listings are readable" on public.loans
  for select to anon, authenticated
  using (
    (loan_status = 'Requested'::public.loan_status and on_hold_reason is distinct from 'admin_hidden')
    or is_sellable = true
  );


-- 3) Hide / unhide ----------------------------------------------------------------------------------
-- Admins only. The hold columns are server-only (trg_keep_loan_hold), so this runs as the function
-- owner. Only an open, unfunded request can be hidden. A request already parked for another reason
-- (missed call, awaiting call) is refused so that un-hiding can never lift that hold by accident.
-- Records the review ('hidden' / back to 'kept') and an admin audit log entry.
create or replace function public.admin_set_loan_request_hidden(
  p_loan_id uuid,
  p_hidden  boolean,
  p_note    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 500), '');
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admins only';
  end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_loan.loan_status <> 'Requested' or v_loan.lender_user_id is not null then
    return jsonb_build_object('error', 'not_open');
  end if;

  if p_hidden then
    if v_loan.on_hold_since is not null and v_loan.on_hold_reason is distinct from 'admin_hidden' then
      return jsonb_build_object('error', 'already_on_hold', 'reason', v_loan.on_hold_reason);
    end if;
    update public.loans
       set on_hold_since = coalesce(on_hold_since, now()),
           on_hold_reason = 'admin_hidden'
     where id = p_loan_id;
  else
    if v_loan.on_hold_reason is distinct from 'admin_hidden' then
      return jsonb_build_object('error', 'not_hidden');
    end if;
    update public.loans
       set on_hold_since = null,
           on_hold_reason = null
     where id = p_loan_id;
  end if;

  insert into public.admin_loan_request_reviews
    (loan_id, borrower_user_id, status, reason, risk_level, evidence_summary, admin_note, reviewed_by, reviewed_at)
  values (
    p_loan_id,
    v_loan.borrower_user_id,
    case when p_hidden then 'hidden' else 'kept' end,
    'manual',
    case when p_hidden then 'medium' else 'low' end,
    case when p_hidden then 'Admin hid this request from the board. Nothing was deleted.'
         else 'Admin put this request back on the board.' end,
    v_note,
    auth.uid(),
    now()
  )
  on conflict (loan_id) do update
    set status = excluded.status,
        reason = excluded.reason,
        risk_level = excluded.risk_level,
        evidence_summary = excluded.evidence_summary,
        admin_note = excluded.admin_note,
        reviewed_by = excluded.reviewed_by,
        reviewed_at = excluded.reviewed_at;

  insert into public.admin_audit_logs (actor_user_id, action, target_table, target_id, target_user_id, metadata)
  values (
    auth.uid(),
    case when p_hidden then 'loan_request_hidden' else 'loan_request_unhidden' end,
    'loans',
    p_loan_id,
    v_loan.borrower_user_id,
    jsonb_build_object('tracking_id', v_loan.tracking_id, 'note', v_note, 'source', 'live_admin_panel')
  );

  return jsonb_build_object('loan_id', p_loan_id, 'hidden', p_hidden);
end;
$$;

revoke all on function public.admin_set_loan_request_hidden(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_loan_request_hidden(uuid, boolean, text) to authenticated, service_role, postgres;
