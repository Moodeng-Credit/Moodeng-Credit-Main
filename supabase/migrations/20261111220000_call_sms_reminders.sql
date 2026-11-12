-- Text reminders for the video call (Philippine numbers, through UniSMS like the sign-in codes).
--
-- Who gets one: a borrower with a number we can text — the one they signed up with (auth.users.phone,
-- confirmed), or one they gave us just for this (private.call_sms_numbers: typed on the "You're booked"
-- screen, or sent to our Messenger bot). Numbers typed for reminders are not checked with a code.
--
-- What they get, per booking (private.call_sms_sends, one row per booking + time + kind):
--   booked   right when the call is booked or moved (trigger on public.users), or when they add a number
--   confirm  1 hour before, when they still have to tap "I'll be there"      } sent by video-call-reminders
--   hour     1 hour before, when they already confirmed                       } (public.call_sms_remind)
-- Plain words only, no links: UniSMS and the networks refuse texts with links.
--
-- Limits: one text per booking + kind; 5 number changes per account; 200 texts a day overall.
-- Switch: telegram_bot_settings 'call_sms_reminders' = 'on' (anything else: nothing is sent, the app
-- and the bot stop asking). UniSMS reaches Globe, TM, GOMO and DITO; a Smart/TNT/Sun number is refused
-- (HTTP 422), so we tell the borrower and drop the number.

create table if not exists private.call_sms_numbers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  digits     text not null check (digits ~ '^639[0-9]{9}$'),
  source     text not null check (source in ('web', 'messenger')),
  changes    integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.call_sms_numbers enable row level security;

create table if not exists private.call_sms_sends (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  booking_uid    text not null,
  starts_at      timestamptz not null,
  kind           text not null check (kind in ('booked', 'confirm', 'hour')),
  status         text not null default 'sending'
                 check (status in ('sending', 'sent', 'unconfirmed', 'rejected_network', 'failed')),
  failure_reason text,
  created_at     timestamptz not null default now(),
  unique (booking_uid, starts_at, kind)
);
create index if not exists call_sms_sends_created_idx on private.call_sms_sends (created_at desc);
alter table private.call_sms_sends enable row level security;

insert into public.telegram_bot_settings (key, value, description)
values ('call_sms_reminders', 'on', 'Video call text reminders (UniSMS, PH numbers): on = send them and ask for a number after booking; anything else = off')
on conflict (key) do nothing;

-- ── helpers ─────────────────────────────────────────────────────────────────────────────────────────

create or replace function private.call_sms_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select replace(btrim(value), '"', '') = 'on' from public.telegram_bot_settings
                   where key = 'call_sms_reminders'), false);
$$;

-- What they typed → 639XXXXXXXXX. 'non_ph' for another country's number, null for anything else.
create or replace function private.call_sms_normalize(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_raw    text := btrim(coalesce(p_phone, ''));
  v_digits text := regexp_replace(v_raw, '[^0-9]', '', 'g');
begin
  if v_raw like '+%' and v_digits !~ '^63' then return 'non_ph'; end if;
  if v_digits ~ '^639[0-9]{9}$' then return v_digits; end if;
  if v_digits ~ '^09[0-9]{9}$' then return '63' || substr(v_digits, 2); end if;
  if v_digits ~ '^9[0-9]{9}$' then return '63' || v_digits; end if;
  return null;
end;
$$;

-- The number we text: the one given for reminders, else the confirmed sign-up number.
create or replace function private.call_sms_digits(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select digits from private.call_sms_numbers where user_id = p_user),
    (select phone from auth.users where id = p_user and phone_confirmed_at is not null and phone ~ '^639[0-9]{9}$'));
$$;

-- 639171234567 → "0917 ••• 4567"
create or replace function private.call_sms_mask(p_digits text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_digits ~ '^639[0-9]{9}$' then '0' || substr(p_digits, 3, 3) || ' ••• ' || right(p_digits, 4) end;
$$;

-- ── sending ─────────────────────────────────────────────────────────────────────────────────────────

-- Texts this borrower about their upcoming call, once per booking + kind. Returns what happened:
-- sent | unconfirmed (timed out, may have gone) | already | off | no_call | no_number | cap |
-- rejected_network | failed | bad_kind. Never raises.
create or replace function private.call_sms_send(p_user uuid, p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      text;
  v_starts   timestamptz;
  v_zone     text;
  v_local    timestamp;
  v_day      text;
  v_clock    text;
  v_digits   text;
  v_id       uuid;
  v_key      text;
  v_sender   text;
  v_text     text;
  v_response extensions.http_response;
begin
  if p_kind not in ('booked', 'confirm', 'hour') then return 'bad_kind'; end if;
  if not private.call_sms_enabled() then return 'off'; end if;

  select video_call_booking_uid, video_call_starts_at, coalesce(nullif(btrim(video_call_timezone), ''), 'Asia/Manila')
    into v_uid, v_starts, v_zone
    from public.users where id = p_user;
  if v_uid is null or v_starts is null or v_starts <= now() then return 'no_call'; end if;

  v_digits := private.call_sms_digits(p_user);
  if v_digits is null then return 'no_number'; end if;

  if (select count(*) from private.call_sms_sends
      where created_at > now() - interval '24 hours' and status in ('sent', 'unconfirmed')) >= 200 then
    perform private.sms_alert('call_sms_cap', '200 call reminder texts went out in the last 24 hours, so no more are sent until that drops.', interval '12 hours');
    return 'cap';
  end if;

  select nullif(btrim(decrypted_secret), '') into v_key from vault.decrypted_secrets where name = 'UNISMS_SECRET_KEY' limit 1;
  select nullif(btrim(decrypted_secret), '') into v_sender from vault.decrypted_secrets where name = 'UNISMS_SENDER_ID' limit 1;
  if v_key is null or v_sender is null then
    perform private.sms_alert('call_sms_no_key', 'Call reminder texts are not going out: Vault has no UNISMS_SECRET_KEY or UNISMS_SENDER_ID.', interval '12 hours');
    return 'failed';
  end if;

  -- Claim this booking + kind first, so two callers can't both text it.
  insert into private.call_sms_sends (user_id, booking_uid, starts_at, kind)
  values (p_user, v_uid, v_starts, p_kind)
  on conflict (booking_uid, starts_at, kind) do nothing
  returning id into v_id;
  if v_id is null then return 'already'; end if;

  begin
    v_local := v_starts at time zone v_zone;
  exception when others then
    v_zone := 'Asia/Manila';
    v_local := v_starts at time zone v_zone;
  end;
  v_clock := to_char(v_local, 'FMHH12:MI AM');
  v_day := to_char(v_local, 'Dy, Mon FMDD') || ', ' || v_clock
           || case when v_zone = 'Asia/Manila' then '' else ' (' || replace(split_part(v_zone, '/', 2), '_', ' ') || ' time)' end;

  v_text := case p_kind
    when 'booked' then
      format('Moodeng Credit: your video call is booked for %s.', v_day)
      || case when v_starts > now() + interval '65 minutes' then ' We will text you again 1 hour before.' else '' end
      || ' Have your ID ready.'
    when 'confirm' then
      format('Moodeng Credit: your video call is in 1 hour (%s). Open Messenger or the Moodeng app and tap I''ll be there in the next 30 minutes, or it is cancelled.', v_clock)
    else
      format('Moodeng Credit: your video call is in 1 hour (%s). Have your ID ready and your camera on.', v_clock)
  end;

  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '1500');
    v_response := extensions.http((
      'POST',
      'https://unismsapi.com/api/sms',
      array[extensions.http_header('Authorization',
        'Basic ' || replace(encode(convert_to(v_key || ':', 'UTF8'), 'base64'), E'\n', ''))],
      'application/json',
      jsonb_build_object('recipient', '+' || v_digits, 'content', v_text, 'sender_id', v_sender)::text
    )::extensions.http_request);
  exception when others then
    update private.call_sms_sends set status = 'unconfirmed', failure_reason = left(sqlerrm, 120) where id = v_id;
    return 'unconfirmed';
  end;

  if v_response.status between 200 and 299 then
    update private.call_sms_sends set status = 'sent' where id = v_id;
    return 'sent';
  end if;

  if v_response.status = 422 and v_response.content ~* 'smart|tnt|sun' then
    update private.call_sms_sends set status = 'rejected_network', failure_reason = 'unisms: smart/tnt/sun' where id = v_id;
    return 'rejected_network';
  end if;

  update private.call_sms_sends
     set status = 'failed', failure_reason = left('unisms: http ' || v_response.status || ' ' || coalesce(v_response.content, ''), 200)
   where id = v_id;
  perform private.sms_alert('call_sms_failed', format('UniSMS refused a call reminder text (HTTP %s): %s', v_response.status, left(coalesce(v_response.content, ''), 160)));
  return 'failed';
exception when others then
  return 'failed';
end;
$$;

-- Saves a reminder number for this borrower and texts the "booked" line for their upcoming call.
create or replace function private.call_sms_save(p_user uuid, p_phone text, p_source text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits  text := private.call_sms_normalize(p_phone);
  v_current private.call_sms_numbers%rowtype;
  v_uid     text;
  v_starts  timestamptz;
  v_sent    text;
begin
  if p_user is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  if not private.call_sms_enabled() then return jsonb_build_object('ok', false, 'error', 'off'); end if;
  if v_digits = 'non_ph' then return jsonb_build_object('ok', false, 'error', 'non_ph'); end if;
  if v_digits is null then return jsonb_build_object('ok', false, 'error', 'bad_phone'); end if;

  select * into v_current from private.call_sms_numbers where user_id = p_user for update;
  if found and v_current.digits <> v_digits then
    if v_current.changes >= 5 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
    update private.call_sms_numbers
       set digits = v_digits, source = p_source, changes = changes + 1, updated_at = now()
     where user_id = p_user;
    -- The new number gets the "booked" text for the call they already have.
    select video_call_booking_uid, video_call_starts_at into v_uid, v_starts from public.users where id = p_user;
    delete from private.call_sms_sends where booking_uid = v_uid and starts_at = v_starts and kind = 'booked';
  elsif not found then
    insert into private.call_sms_numbers (user_id, digits, source) values (p_user, v_digits, p_source);
  end if;

  v_sent := private.call_sms_send(p_user, 'booked');
  if v_sent = 'rejected_network' then
    delete from private.call_sms_numbers where user_id = p_user;
    return jsonb_build_object('ok', false, 'error', 'network');
  end if;
  return jsonb_build_object('ok', true, 'number', private.call_sms_mask(v_digits), 'texted', v_sent in ('sent', 'unconfirmed', 'already'));
end;
$$;

-- A call was booked or moved: text the "booked" line. Never blocks the booking.
create or replace function private.call_sms_on_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform private.call_sms_send(new.id, 'booked');
  exception when others then
    null;
  end;
  return null;
end;
$$;

drop trigger if exists trg_call_sms_on_booking on public.users;
create trigger trg_call_sms_on_booking
  after update of video_call_booking_uid, video_call_starts_at on public.users
  for each row
  when (new.video_call_booking_uid is not null
        and new.video_call_starts_at is not null
        and (new.video_call_booking_uid is distinct from old.video_call_booking_uid
             or new.video_call_starts_at is distinct from old.video_call_starts_at))
  execute function private.call_sms_on_booking();

-- ── what the app and the edge functions call ────────────────────────────────────────────────────────

-- {enabled, eligible, number, source}. The signed-in borrower's own, or (service role) anyone's.
-- eligible: we could text them — a number on file, or they book in Manila time.
create or replace function public.call_sms_status(p_user uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user   uuid := case when p_user is null then auth.uid() when auth.role() = 'service_role' then p_user end;
  v_digits text;
  v_own    boolean;
  v_zone   text;
begin
  if v_user is null then return jsonb_build_object('enabled', false, 'eligible', false); end if;
  v_digits := private.call_sms_digits(v_user);
  v_own := exists (select 1 from private.call_sms_numbers where user_id = v_user);
  select coalesce(nullif(btrim(video_call_timezone), ''), nullif(btrim(timezone), '')) into v_zone from public.users where id = v_user;
  return jsonb_build_object(
    'enabled', private.call_sms_enabled(),
    'eligible', v_digits is not null or v_zone = 'Asia/Manila',
    'number', private.call_sms_mask(v_digits),
    'source', case when v_digits is null then null when v_own then 'entered' else 'signup' end);
end;
$$;

-- The signed-in borrower gives us a number. {ok, number, texted} or {ok:false, error:
-- bad_phone | non_ph | network | too_many | off | not_signed_in}
create or replace function public.call_sms_save(p_phone text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.call_sms_save(auth.uid(), p_phone, 'web');
$$;

-- Service role only: a number the borrower sent to the Messenger bot.
create or replace function public.call_sms_save_for(p_user uuid, p_phone text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.call_sms_save(p_user, p_phone, 'messenger');
$$;

-- Service role only: the 1-hour text (p_kind 'confirm' or 'hour'). Returns call_sms_send's word.
create or replace function public.call_sms_remind(p_user uuid, p_kind text)
returns text
language sql
security definer
set search_path = ''
as $$
  select case when p_kind in ('confirm', 'hour') then private.call_sms_send(p_user, p_kind) else 'bad_kind' end;
$$;

revoke all on function private.call_sms_enabled() from public, anon, authenticated;
revoke all on function private.call_sms_normalize(text) from public, anon, authenticated;
revoke all on function private.call_sms_digits(uuid) from public, anon, authenticated;
revoke all on function private.call_sms_mask(text) from public, anon, authenticated;
revoke all on function private.call_sms_send(uuid, text) from public, anon, authenticated;
revoke all on function private.call_sms_save(uuid, text, text) from public, anon, authenticated;
revoke all on function private.call_sms_on_booking() from public, anon, authenticated;

revoke all on function public.call_sms_status(uuid) from public, anon;
grant execute on function public.call_sms_status(uuid) to authenticated, service_role;
revoke all on function public.call_sms_save(text) from public, anon;
grant execute on function public.call_sms_save(text) to authenticated, service_role;
revoke all on function public.call_sms_save_for(uuid, text) from public, anon, authenticated;
grant execute on function public.call_sms_save_for(uuid, text) to service_role;
revoke all on function public.call_sms_remind(uuid, text) from public, anon, authenticated;
grant execute on function public.call_sms_remind(uuid, text) to service_role;
