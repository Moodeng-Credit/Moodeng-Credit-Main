-- Changes log: one row per state change of the things the team watches (loans, loan access, KYC,
-- vouchers, Messenger), written by triggers so EVERY path is covered — edge functions, the admin
-- panel, Telegram buttons, crons and manual SQL.
--
-- Each new row is handed to the edge function state-events-dispatch (pg_net, vault secrets — same
-- pattern as private.notify_voucher_claim_decided), which edits the Telegram cards and Discord posts
-- about it (admin_message_refs) to show the outcome: "✅ FUNDED by @lender", "⚠️ OVERDUE",
-- "💸 REPAID (late)", "✅ APPROVED", "❌ KYC DECLINED"…
--
-- Overdue and expired are time-based (no row changes), so an hourly cron emits them once per loan.

create table if not exists public.state_events (
  id bigserial primary key,
  kind text not null,
  ref_id text not null,
  user_id uuid null,
  from_state text null,
  to_state text not null,
  actor text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- Set by state-events-dispatch when it claims the row (exactly-once dispatch).
  dispatched_at timestamptz null
);

create index if not exists state_events_kind_ref_idx on public.state_events (kind, ref_id, to_state);
create index if not exists state_events_user_idx on public.state_events (user_id, created_at desc);
create index if not exists state_events_created_idx on public.state_events (created_at desc);

-- Admins can read; nobody writes from a client (triggers are security definer, the dispatcher
-- uses the service role).
alter table public.state_events enable row level security;
revoke all on public.state_events from anon, authenticated;
grant select on public.state_events to authenticated;
revoke all on sequence public.state_events_id_seq from anon, authenticated;

drop policy if exists state_events_admin_select on public.state_events;
create policy state_events_admin_select on public.state_events
  for select to authenticated
  using (app_private.is_moodeng_admin());

do $$
begin
  alter publication supabase_realtime add table public.state_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ---- Helpers --------------------------------------------------------------------------------

-- Who made the change: the admin signed in to the panel (auth.uid()), else null (service role,
-- cron, SQL) — callers fall back to a column such as decided_by, then 'system'.
create or replace function private.state_event_admin_actor()
returns text
language sql
stable
security definer
set search_path = 'public'
as $$
  select display_name from public.admin_users where user_id = auth.uid() and active limit 1;
$$;

create or replace function private.log_state_event(
  p_kind text, p_ref_id text, p_user_id uuid, p_from text, p_to text, p_actor text, p_meta jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.state_events (kind, ref_id, user_id, from_state, to_state, actor, meta)
  values (p_kind, p_ref_id, p_user_id, p_from, p_to, coalesce(p_actor, 'system'), coalesce(p_meta, '{}'::jsonb));
exception when others then
  -- The log must never block the change it records.
  raise warning 'state_events insert failed (% %→%): %', p_kind, p_from, p_to, sqlerrm;
end;
$$;

revoke all on function private.state_event_admin_actor() from public, anon, authenticated;
revoke all on function private.log_state_event(text, text, uuid, text, text, text, jsonb) from public, anon, authenticated;

-- ---- loans ----------------------------------------------------------------------------------

create or replace function private.log_loan_state_events()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  admin_actor text := private.state_event_admin_actor();
  lender_name text;
  refunder text;
  was_overdue boolean;
begin
  if tg_op = 'DELETE' then
    perform private.log_state_event('loan', old.id::text, old.borrower_user_id,
      lower(old.loan_status::text), 'deleted', admin_actor,
      jsonb_build_object('tracking_id', old.tracking_id));
    return old;
  end if;

  if old.loan_status is distinct from new.loan_status and new.loan_status::text = 'Lent' then
    select '@' || username into lender_name from public.users where id = new.lender_user_id;
    perform private.log_state_event('loan', new.id::text, new.borrower_user_id,
      'requested', 'funded', coalesce(admin_actor, lender_name),
      jsonb_build_object('lender_user_id', new.lender_user_id, 'lender', lender_name, 'tracking_id', new.tracking_id));
  end if;

  if old.repayment_status is distinct from new.repayment_status and new.repayment_status::text in ('Paid', 'Partial') then
    was_overdue := new.due_date is not null and new.due_date < coalesce(new.repaid_at, now());
    perform private.log_state_event('loan', new.id::text, new.borrower_user_id,
      lower(coalesce(old.repayment_status::text, 'unpaid')),
      case when new.repayment_status::text = 'Paid' then 'repaid' else 'partial' end,
      admin_actor,
      jsonb_build_object('late', was_overdue, 'repaid_amount', new.repaid_amount, 'tracking_id', new.tracking_id));
  end if;

  if old.refunded_at is null and new.refunded_at is not null then
    select display_name into refunder from public.admin_users where user_id = new.refunded_by limit 1;
    perform private.log_state_event('loan', new.id::text, new.borrower_user_id,
      lower(coalesce(new.repayment_status::text, 'unpaid')), 'refunded', coalesce(admin_actor, refunder),
      jsonb_build_object('reason', new.refund_reason, 'tracking_id', new.tracking_id));
  end if;

  return new;
end;
$$;

revoke all on function private.log_loan_state_events() from public, anon, authenticated;

drop trigger if exists log_loan_state_events on public.loans;
create trigger log_loan_state_events
  after update of loan_status, repayment_status, refunded_at on public.loans
  for each row
  when (
    old.loan_status is distinct from new.loan_status
    or old.repayment_status is distinct from new.repayment_status
    or (old.refunded_at is null and new.refunded_at is not null)
  )
  execute function private.log_loan_state_events();

drop trigger if exists log_loan_state_events_delete on public.loans;
create trigger log_loan_state_events_delete
  after delete on public.loans
  for each row
  execute function private.log_loan_state_events();

-- ---- users ----------------------------------------------------------------------------------

create or replace function private.log_user_state_events()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  admin_actor text := private.state_event_admin_actor();
  didit_new text := lower(coalesce(new.didit_id_status, ''));
begin
  if old.loan_access_status is distinct from new.loan_access_status then
    perform private.log_state_event('loan_access', new.id::text, new.id,
      old.loan_access_status::text, new.loan_access_status::text, admin_actor);
  end if;

  if old.video_call_outcome is distinct from new.video_call_outcome and new.video_call_outcome is not null then
    perform private.log_state_event('video_call', new.id::text, new.id,
      old.video_call_outcome, new.video_call_outcome, admin_actor);
  end if;

  -- KYC: approved = is_didit ACTIVE; declined / in review / duplicate from didit_id_status.
  if old.is_didit is distinct from new.is_didit and new.is_didit::text = 'ACTIVE' then
    perform private.log_state_event('kyc', new.id::text, new.id,
      lower(coalesce(old.didit_id_status, 'none')), 'approved', admin_actor);
  end if;
  if old.didit_id_status is distinct from new.didit_id_status then
    if didit_new like 'declin%' then
      perform private.log_state_event('kyc', new.id::text, new.id, lower(old.didit_id_status), 'declined', admin_actor,
        jsonb_build_object('reason', new.didit_decline_reason));
    elsif didit_new like '%review%' then
      perform private.log_state_event('kyc', new.id::text, new.id, lower(old.didit_id_status), 'in_review', admin_actor);
    elsif didit_new like '%dup%' then
      perform private.log_state_event('kyc', new.id::text, new.id, lower(old.didit_id_status), 'duplicate', admin_actor);
    end if;
  end if;

  if old.is_world_id is distinct from new.is_world_id then
    perform private.log_state_event('world_id', new.id::text, new.id,
      lower(coalesce(old.is_world_id::text, 'inactive')), lower(new.is_world_id::text), admin_actor);
  end if;

  if old.account_status is distinct from new.account_status then
    perform private.log_state_event('account', new.id::text, new.id,
      old.account_status::text, new.account_status::text, admin_actor);
  end if;

  if old.messenger_verified_at is null and new.messenger_verified_at is not null then
    perform private.log_state_event('messenger', new.id::text, new.id, 'unverified', 'verified', admin_actor);
  end if;

  return new;
end;
$$;

revoke all on function private.log_user_state_events() from public, anon, authenticated;

-- The WHEN clause keeps the (hot) users table cheap: the function only runs on a real change.
drop trigger if exists log_user_state_events on public.users;
create trigger log_user_state_events
  after update of loan_access_status, video_call_outcome, is_didit, didit_id_status, is_world_id, account_status, messenger_verified_at
  on public.users
  for each row
  when (
    old.loan_access_status is distinct from new.loan_access_status
    or old.video_call_outcome is distinct from new.video_call_outcome
    or old.is_didit is distinct from new.is_didit
    or old.didit_id_status is distinct from new.didit_id_status
    or old.is_world_id is distinct from new.is_world_id
    or old.account_status is distinct from new.account_status
    or (old.messenger_verified_at is null and new.messenger_verified_at is not null)
  )
  execute function private.log_user_state_events();

-- ---- loan_access_requests -------------------------------------------------------------------

create or replace function private.log_loan_access_request_state_events()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform private.log_state_event('loan_access_request', new.user_id::text, new.user_id,
    case when tg_op = 'INSERT' then null else old.status end, new.status,
    coalesce(private.state_event_admin_actor(), new.decided_by),
    jsonb_build_object('request_id', new.id));
  return new;
end;
$$;

revoke all on function private.log_loan_access_request_state_events() from public, anon, authenticated;

drop trigger if exists log_loan_access_request_state_events on public.loan_access_requests;
create trigger log_loan_access_request_state_events
  after update of status on public.loan_access_requests
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_loan_access_request_state_events();

-- ---- voucher_claims -------------------------------------------------------------------------

create or replace function private.log_voucher_claim_state_events()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  perform private.log_state_event('voucher', new.id::text, new.user_id,
    old.status, new.status, private.state_event_admin_actor());
  return new;
end;
$$;

revoke all on function private.log_voucher_claim_state_events() from public, anon, authenticated;

drop trigger if exists log_voucher_claim_state_events on public.voucher_claims;
create trigger log_voucher_claim_state_events
  after update of status on public.voucher_claims
  for each row
  when (old.status is distinct from new.status)
  execute function private.log_voucher_claim_state_events();

-- ---- Time-based: overdue + expired (hourly) -------------------------------------------------

-- Emits 'overdue' once per funded, unpaid loan past its due date, and 'expired' once per request
-- older than 7 days (REQUEST_EXPIRATION_DAYS default in loan-request-expired-notifications). The
-- short look-back windows mean loans that were already late before this shipped aren't backfilled.
create or replace function private.emit_time_based_state_events()
returns integer
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  n integer := 0;
  m integer := 0;
begin
  insert into public.state_events (kind, ref_id, user_id, from_state, to_state, actor, meta)
  select 'loan', l.id::text, l.borrower_user_id,
         lower(coalesce(l.repayment_status::text, 'unpaid')), 'overdue', 'system',
         jsonb_build_object('due_date', l.due_date, 'tracking_id', l.tracking_id)
    from public.loans l
   where l.loan_status::text = 'Lent'
     and coalesce(l.repayment_status::text, 'Unpaid') <> 'Paid'
     and l.refunded_at is null
     and l.due_date < now()
     and l.due_date > now() - interval '2 days'
     and not exists (
       select 1 from public.state_events e
        where e.kind = 'loan' and e.ref_id = l.id::text and e.to_state = 'overdue'
     );
  get diagnostics n = row_count;

  insert into public.state_events (kind, ref_id, user_id, from_state, to_state, actor, meta)
  select 'loan', l.id::text, l.borrower_user_id, 'requested', 'expired', 'system',
         jsonb_build_object('tracking_id', l.tracking_id)
    from public.loans l
   where l.loan_status::text = 'Requested'
     and l.created_at < now() - interval '7 days'
     and l.created_at > now() - interval '9 days'
     and not exists (
       select 1 from public.state_events e
        where e.kind = 'loan' and e.ref_id = l.id::text and e.to_state = 'expired'
     );
  get diagnostics m = row_count;

  return n + m;
end;
$$;

revoke all on function private.emit_time_based_state_events() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('state-events-time-based-hourly');
exception
  when others then null;
end $$;

select cron.schedule(
  'state-events-time-based-hourly',
  '20 * * * *',
  $$ select private.emit_time_based_state_events(); $$
);

-- ---- Dispatcher -----------------------------------------------------------------------------

create or replace function private.dispatch_state_event()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'vault', 'net'
as $$
declare
  project_url text;
  service_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;

  if project_url is null or service_key is null then
    raise warning 'state-events-dispatch skipped: Supabase project URL or secret key missing from vault.';
    return new;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/state-events-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('eventId', new.id)
  );
  return new;
exception when others then
  raise warning 'state-events-dispatch call failed: %', sqlerrm;
  return new;
end;
$$;

revoke all on function private.dispatch_state_event() from public, anon, authenticated;

-- Only events that can change a posted card are sent (not world_id / account / 'pending').
drop trigger if exists dispatch_state_event on public.state_events;
create trigger dispatch_state_event
  after insert on public.state_events
  for each row
  when (
    new.kind in ('loan', 'loan_access', 'loan_access_request', 'video_call', 'kyc', 'voucher', 'messenger')
    and new.to_state not in ('pending', 'none', 'requested')
  )
  execute function private.dispatch_state_event();
