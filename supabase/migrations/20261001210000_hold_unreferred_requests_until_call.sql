-- A borrower without a referral who has never had a loan funded must attend their video call before
-- lenders see their request (George, 2026-10-01). Until now the request went on the board the moment
-- they BOOKED the call, which is how a no-show (kryshia) got funded.
--
-- Such a request is created ON HOLD (on_hold_reason 'awaiting_call'): hidden from lenders, not
-- fundable, and the team gets a "waiting for their call" note instead of lender pings. When the call
-- is marked Showed up (video_call_outcome → 'attended') the hold lifts and the request is announced
-- exactly as a new one is: team post, lender suggestions, repeat-lender push. A no-show leaves it on
-- hold; only attending releases it.
--
-- Same rule as the app (requestContactSteps: loan_flow 'open', not referred, not an existing
-- borrower, not exempt).

-- 1) One place that announces a request (team post + lender pings). Lender pings are skipped while
--    a request is on hold.
create or replace function private.announce_loan_request(p_loan_id uuid, p_ping_lenders boolean)
returns void
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $$
declare
  project_url text;
  service_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;
  if project_url is null or service_key is null then
    raise warning 'Loan request notifications skipped: Supabase project URL or secret key missing from vault.';
    return;
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/loan-request-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('loanId', p_loan_id)
  );
  if not p_ping_lenders then
    return;
  end if;
  perform net.http_post(
    url := project_url || '/functions/v1/loan-request-lender-suggestions',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('loanId', p_loan_id)
  );
  perform net.http_post(
    url := project_url || '/functions/v1/loan-request-repeat-lender-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('loanId', p_loan_id)
  );
end;
$$;

create or replace function private.notify_loan_request_telegram()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $$
begin
  if new.loan_status <> 'Requested' then
    return new;
  end if;
  perform private.announce_loan_request(new.id, new.on_hold_since is null);
  return new;
end;
$$;

-- 2) Create first-time, non-referred requests on hold until the call.
create or replace function app_private.hold_request_until_first_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.loan_status = 'Requested'
     and new.borrower_user_id is not null
     and public.get_loan_flow() = 'open'
     -- CONTACT_STEP_EXEMPT_USER_IDS in src/config/contactVerification.ts
     and new.borrower_user_id not in ('28cd3b3e-a975-48ab-9db3-a23f74c01d42', 'a629dfa3-ebe0-4365-b267-294b19a6ead1')
     and not exists (
       select 1 from public.users as u
       where u.id = new.borrower_user_id
         and (u.redeemed_referral_code_id is not null or u.video_call_outcome = 'attended')
     )
     and not exists (
       select 1 from public.loans as l where l.borrower_user_id = new.borrower_user_id and l.funded_at is not null
     ) then
    new.on_hold_since := now();
    new.on_hold_reason := 'awaiting_call';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hold_request_until_first_call on public.loans;
create trigger trg_hold_request_until_first_call
  before insert on public.loans
  for each row execute function app_private.hold_request_until_first_call();

-- 3) Release: "Showed up" lifts both kinds of hold and announces requests that were never shown; a
--    new booking only lifts a no-show hold.
create or replace function app_private.hold_requests_on_call_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  awaiting_ids uuid[];
  loan_id uuid;
begin
  if new.video_call_outcome = 'no_show' and old.video_call_outcome is distinct from 'no_show' then
    update public.loans
       set on_hold_since = now(), on_hold_reason = 'no_show'
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_since is null;
  elsif new.video_call_outcome = 'attended' and old.video_call_outcome is distinct from 'attended' then
    -- Requests lenders have never seen get announced once released; no-show holds were announced
    -- when they were first posted.
    select coalesce(array_agg(l.id), '{}') into awaiting_ids
      from public.loans as l
     where l.borrower_user_id = new.id
       and l.loan_status = 'Requested'
       and l.on_hold_reason = 'awaiting_call';
    update public.loans
       set on_hold_since = null, on_hold_reason = null
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason in ('no_show', 'awaiting_call');
    foreach loan_id in array awaiting_ids loop
      perform private.announce_loan_request(loan_id, true);
    end loop;
  elsif new.video_call_starts_at is not null
     and new.video_call_starts_at is distinct from old.video_call_starts_at
     and new.video_call_starts_at > now() then
    update public.loans
       set on_hold_since = null, on_hold_reason = null
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason = 'no_show';
  end if;
  return new;
end;
$$;
