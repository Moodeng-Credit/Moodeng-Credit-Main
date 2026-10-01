-- A loan is due until the END of its due day in the BORROWER'S time zone.
--
-- loans.due_date is a calendar date stored as midnight UTC. Read as an instant that is 8 AM in
-- Manila on the due day, which is when borrowers were told "overdue" and the app said "Past due".
-- The deadline is now 00:00 on the day after the due date, in the time zone the loan was posted
-- from. The zone is saved on the loan when it is created and never moves, so travelling can't shift
-- a deadline, and the app, the reminders and the team posts all read the same value.
--
--   users.timezone       the borrower's device time zone, reported by the app (set_my_timezone)
--   loans.due_timezone   the zone the deadline is measured in, saved at insert, server-only
--   team_timezone        setting: the zone the team reads deadlines in (Telegram / Discord)

alter table public.users add column if not exists timezone text;
comment on column public.users.timezone is
   'IANA time zone of the borrower''s device, reported by the app via set_my_timezone(). Used to fix a new loan''s due_timezone.';

alter table public.loans add column if not exists due_timezone text;
comment on column public.loans.due_timezone is
   'IANA zone the due day is measured in (overdue from 00:00 the day after due_date, in this zone). Set at insert from the borrower; never changed by clients.';

-- A usable zone: a real IANA name, and not UTC/GMT/Etc, which on a phone or laptop almost always
-- means "never set" rather than where the borrower actually is.
create or replace function app_private.is_usable_timezone(p_zone text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_zone is not null
     and p_zone !~* '^(utc|gmt|etc/|zulu|universal|uct)'
     and exists (select 1 from pg_catalog.pg_timezone_names where name = p_zone);
$$;

-- Country → the zone most of its borrowers live in (mirrors COUNTRY_TIMEZONES in
-- supabase/functions/_shared/loanDeadline.ts).
create or replace function app_private.country_timezone(p_iso text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case upper(coalesce(p_iso, ''))
    when 'PH' then 'Asia/Manila' when 'TH' then 'Asia/Bangkok' when 'ID' then 'Asia/Jakarta'
    when 'MY' then 'Asia/Kuala_Lumpur' when 'SG' then 'Asia/Singapore' when 'VN' then 'Asia/Ho_Chi_Minh'
    when 'KH' then 'Asia/Phnom_Penh' when 'LA' then 'Asia/Vientiane' when 'MM' then 'Asia/Yangon'
    when 'IN' then 'Asia/Kolkata' when 'BD' then 'Asia/Dhaka' when 'PK' then 'Asia/Karachi'
    when 'NP' then 'Asia/Kathmandu' when 'LK' then 'Asia/Colombo' when 'HK' then 'Asia/Hong_Kong'
    when 'MO' then 'Asia/Macau' when 'TW' then 'Asia/Taipei' when 'CN' then 'Asia/Shanghai'
    when 'JP' then 'Asia/Tokyo' when 'KR' then 'Asia/Seoul' when 'AU' then 'Australia/Sydney'
    when 'NZ' then 'Pacific/Auckland' when 'AE' then 'Asia/Dubai' when 'SA' then 'Asia/Riyadh'
    when 'QA' then 'Asia/Qatar' when 'KW' then 'Asia/Kuwait' when 'GB' then 'Europe/London'
    when 'IE' then 'Europe/Dublin' when 'DE' then 'Europe/Berlin' when 'FR' then 'Europe/Paris'
    when 'ES' then 'Europe/Madrid' when 'IT' then 'Europe/Rome' when 'NL' then 'Europe/Amsterdam'
    when 'US' then 'America/New_York' when 'CA' then 'America/Toronto' when 'NG' then 'Africa/Lagos'
    when 'KE' then 'Africa/Nairobi' when 'ZA' then 'Africa/Johannesburg'
    else null
  end;
$$;

-- Best known zone for a user, best first: their device, the zone of a booked call, the country
-- they usually log in from (ignoring VPN/hosting exits, and only once seen on 3+ logins: one stray
-- VPN login from the US must not move a Manila borrower's deadline 12 hours), then Manila (the
-- largest borrower base).
create or replace function app_private.resolve_user_timezone(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_device text;
  v_call text;
  v_country text;
begin
  select u.timezone, u.video_call_timezone into v_device, v_call from public.users as u where u.id = p_user_id;
  if app_private.is_usable_timezone(v_device) then return v_device; end if;
  if app_private.is_usable_timezone(v_call) then return v_call; end if;

  select l.country_iso into v_country
  from public.auth_ip_log as l
  where l.user_id = p_user_id and l.country_iso is not null and not coalesce(l.is_hosting, false)
  group by l.country_iso
  having count(*) >= 3
  order by count(*) desc, max(l.last_seen_at) desc
  limit 1;

  return coalesce(app_private.country_timezone(v_country), 'Asia/Manila');
end;
$$;

-- Fix the zone when the loan is created. Always the server's answer, never a client-supplied one:
-- picking a far-west zone would quietly buy extra hours.
create or replace function app_private.set_loan_due_timezone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.borrower_user_id is not null then
    new.due_timezone := app_private.resolve_user_timezone(new.borrower_user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_loan_due_timezone on public.loans;
create trigger trg_set_loan_due_timezone
  before insert on public.loans
  for each row execute function app_private.set_loan_due_timezone();

-- Clients can't move it afterwards.
create or replace function app_private.keep_loan_due_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.due_timezone := old.due_timezone;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_keep_loan_due_timezone on public.loans;
create trigger trg_keep_loan_due_timezone
  before update on public.loans
  for each row execute function app_private.keep_loan_due_timezone();

-- The app reports the device time zone once per session. Unusable values (UTC etc.) are ignored.
create or replace function public.set_my_timezone(p_zone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not app_private.is_usable_timezone(p_zone) then
    return;
  end if;
  update public.users set timezone = p_zone where id = auth.uid() and timezone is distinct from p_zone;
end;
$$;

revoke all on function public.set_my_timezone(text) from public, anon;
grant execute on function public.set_my_timezone(text) to authenticated;

-- The zone the team reads deadlines in, for the Telegram / Discord posts. Change it when the team
-- moves; nothing is hard-coded.
insert into public.telegram_bot_settings (key, value, description)
values ('team_timezone', 'Asia/Bangkok', 'IANA time zone the team reads loan deadlines in (Telegram / Discord posts), e.g. Asia/Bangkok.')
on conflict (key) do nothing;

-- Backfill loans still to be repaid (open requests and unpaid funded loans). Paid loans are left
-- alone, and updated_at is not bumped: for old loans without repaid_at it stands in for "when it
-- was repaid", so touching it would change past on-time results.
alter table public.loans disable trigger update_loans_updated_at;
update public.loans
   set due_timezone = app_private.resolve_user_timezone(borrower_user_id)
 where due_timezone is null
   and borrower_user_id is not null
   and coalesce(repayment_status::text, 'Unpaid') <> 'Paid';
alter table public.loans enable trigger update_loans_updated_at;
