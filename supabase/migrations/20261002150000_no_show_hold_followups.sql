-- Review of #1031 (2026-10-02).
--
-- 1) A no-show only holds new requests while it's current: recorded after the borrower's latest
--    funded loan. Before, an old no-show (cleared only by booking a new call) held every future
--    request from a borrower who had since been funded and repaid normally.
-- 2) A request held at the moment it was posted (awaiting_call, or a current no-show) was never shown
--    to lenders, so releasing it must announce it: team post + lender suggestions + repeat-lender push.
--    Before, only awaiting_call requests were announced on release; a request posted during a no-show
--    went back on the board silently.

create or replace function app_private.hold_request_until_first_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outcome text;
  v_outcome_at timestamptz;
  v_referred boolean;
  v_last_funded timestamptz;
begin
  if new.loan_status <> 'Requested' or new.borrower_user_id is null or public.get_loan_flow() <> 'open' then
    return new;
  end if;
  -- CONTACT_STEP_EXEMPT_USER_IDS in src/config/contactVerification.ts
  if new.borrower_user_id in ('28cd3b3e-a975-48ab-9db3-a23f74c01d42', 'a629dfa3-ebe0-4365-b267-294b19a6ead1') then
    return new;
  end if;

  select u.video_call_outcome::text, u.video_call_outcome_at, u.redeemed_referral_code_id is not null
    into v_outcome, v_outcome_at, v_referred
    from public.users as u
   where u.id = new.borrower_user_id;

  select max(l.funded_at) into v_last_funded
    from public.loans as l
   where l.borrower_user_id = new.borrower_user_id;

  -- Unreferred and never funded: off the board until they attend a call.
  if not coalesce(v_referred, false) and coalesce(v_outcome, '') <> 'attended' and v_last_funded is null then
    new.on_hold_since := now();
    new.on_hold_reason := 'awaiting_call';
  -- Missed their latest call (and haven't rebooked or been funded since): held until they book again.
  elsif v_outcome = 'no_show' and coalesce(v_outcome_at, now()) > coalesce(v_last_funded, '-infinity'::timestamptz) then
    new.on_hold_since := now();
    new.on_hold_reason := 'no_show';
  end if;
  return new;
end;
$$;

create or replace function app_private.hold_requests_on_call_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  unannounced_ids uuid[];
  loan_id uuid;
begin
  if new.video_call_outcome = 'no_show' and old.video_call_outcome is distinct from 'no_show' then
    update public.loans
       set on_hold_since = now(), on_hold_reason = 'no_show'
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_since is null;
    return new;
  end if;

  if new.video_call_outcome = 'attended' and old.video_call_outcome is distinct from 'attended' then
    -- Held since it was posted (lenders never saw it): announce once released.
    select coalesce(array_agg(l.id), '{}') into unannounced_ids
      from public.loans as l
     where l.borrower_user_id = new.id
       and l.loan_status = 'Requested'
       and l.on_hold_since is not null
       and l.on_hold_since <= l.created_at + interval '10 seconds';
    update public.loans
       set on_hold_since = null, on_hold_reason = null
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason in ('no_show', 'awaiting_call');
  elsif new.video_call_starts_at is not null
     and new.video_call_starts_at is distinct from old.video_call_starts_at
     and new.video_call_starts_at > now() then
    select coalesce(array_agg(l.id), '{}') into unannounced_ids
      from public.loans as l
     where l.borrower_user_id = new.id
       and l.loan_status = 'Requested'
       and l.on_hold_reason = 'no_show'
       and l.on_hold_since <= l.created_at + interval '10 seconds';
    update public.loans
       set on_hold_since = null, on_hold_reason = null
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason = 'no_show';
  else
    return new;
  end if;

  foreach loan_id in array unannounced_ids loop
    perform private.announce_loan_request(loan_id, true);
  end loop;
  return new;
end;
$$;
