-- Review round 5 (2026-10-03).
--
-- 1) video_call_no_shows now logs attendance too (kind 'no_show' | 'attended'), so "is this borrower a
--    current no-show?" survives a booking (which resets users.video_call_outcome): book-then-cancel no
--    longer lets a no-show post a NEW request unheld. The log is only written for the open flow; gated
--    flows already record a no-show on the access request, so one missed call is one strike, not two.
-- 2) users.telegram_id / line_id / chat_id on a client INSERT are kept only when they match the provider
--    id the login function recorded in the auth user's app_metadata (server-set, not user-editable), so
--    nobody can pre-claim someone else's Telegram/LINE id when creating their account.
-- 3) Admins can read the no-show log (the select policy existed but the grant was revoked).

alter table public.video_call_no_shows add column if not exists kind text not null default 'no_show';
alter table public.video_call_no_shows drop constraint if exists video_call_no_shows_kind_check;
alter table public.video_call_no_shows add constraint video_call_no_shows_kind_check check (kind in ('no_show', 'attended'));
grant select on public.video_call_no_shows to authenticated;

create or replace function app_private.hold_requests_on_call_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  unannounced_ids uuid[] := '{}';
  loan_id uuid;
begin
  if new.video_call_outcome = 'no_show' and old.video_call_outcome is distinct from 'no_show' then
    if public.get_loan_flow() = 'open' then
      insert into public.video_call_no_shows (user_id, kind) values (new.id, 'no_show');
    end if;
    update public.loans
       set on_hold_since = now(), on_hold_reason = 'no_show'
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and (on_hold_since is null or on_hold_reason = 'rebooked');
    return new;
  end if;

  if new.video_call_outcome = 'attended' and old.video_call_outcome is distinct from 'attended' then
    insert into public.video_call_no_shows (user_id, kind) values (new.id, 'attended');
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
       and on_hold_reason in ('no_show', 'awaiting_call', 'rebooked');
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
       set on_hold_since = null, on_hold_reason = 'rebooked'
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason = 'no_show';
  elsif old.video_call_starts_at is not null
     and new.video_call_starts_at is null
     and old.video_call_starts_at > now() then
    update public.loans
       set on_hold_since = now(), on_hold_reason = 'no_show'
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason = 'rebooked';
    return new;
  else
    return new;
  end if;

  foreach loan_id in array unannounced_ids loop
    perform private.announce_loan_request(loan_id, true);
  end loop;
  return new;
end;
$$;

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
  v_last_event text;
  v_last_event_at timestamptz;
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

  -- Their latest recorded call result (survives a rebooking resetting video_call_outcome).
  select n.kind, n.recorded_at into v_last_event, v_last_event_at
    from public.video_call_no_shows as n
   where n.user_id = new.borrower_user_id and n.active
   order by n.recorded_at desc
   limit 1;

  if not coalesce(v_referred, false) and coalesce(v_outcome, '') <> 'attended' and v_last_funded is null then
    new.on_hold_since := now();
    new.on_hold_reason := 'awaiting_call';
  elsif (v_outcome = 'no_show' and coalesce(v_outcome_at, now()) > coalesce(v_last_funded, '-infinity'::timestamptz))
     or (coalesce(v_outcome, '') <> 'attended'
         and v_last_event = 'no_show'
         and v_last_event_at > coalesce(v_last_funded, '-infinity'::timestamptz)) then
    -- Missed their latest call and haven't attended (or been funded) since: held until they do.
    new.on_hold_since := now();
    new.on_hold_reason := 'no_show';
  end if;
  return new;
end;
$$;

-- 2) Provider ids on a client insert must match what the login function recorded.
create or replace function app_private.check_provider_ids_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb;
  v_role text;
begin
  -- SECURITY DEFINER (to read auth.users), so current_user is the owner: take the caller's role from
  -- the request JWT, which PostgREST sets and clients can't override.
  v_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', current_user::text);
  if v_role not in ('authenticated', 'anon') then
    return new;
  end if;
  select a.raw_app_meta_data into v_meta from auth.users as a where a.id = new.id;
  if new.telegram_id is not null and new.telegram_id::text is distinct from (v_meta ->> 'telegram_id') then
    new.telegram_id := null;
    new.chat_id := null;
    new.telegram_username := null;
  end if;
  if new.chat_id is not null and new.chat_id::text is distinct from new.telegram_id::text then
    new.chat_id := null;
  end if;
  if new.line_id is not null and new.line_id::text is distinct from (v_meta ->> 'line_id') then
    new.line_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_provider_ids_on_insert on public.users;
create trigger trg_check_provider_ids_on_insert
  before insert on public.users
  for each row execute function app_private.check_provider_ids_on_insert();
