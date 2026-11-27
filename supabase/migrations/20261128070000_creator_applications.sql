-- moodeng.app/creator: creators apply to be Moodeng affiliates.
-- Flow: form → 6-digit code emailed → verified = application number (MDG-YYYY-NNNN) + confirmation email
-- + team Telegram card → Admin → Affiliates approves (makes a one-time /partner/TOKEN link and emails it)
-- or rejects (email). Anyone can check status with number + email.
-- Nobody reads the table directly: anon/authenticated only go through the functions below.

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  app_number text unique,
  full_name text not null check (char_length(full_name) between 2 and 120),
  address text not null check (char_length(address) between 5 and 300),
  phone text not null check (char_length(phone) between 6 and 40),
  email text not null check (char_length(email) between 5 and 200),
  facebook_url text check (char_length(facebook_url) <= 300),
  tiktok_url text check (char_length(tiktok_url) <= 300),
  youtube_url text check (char_length(youtube_url) <= 300),
  instagram_url text check (char_length(instagram_url) <= 300),
  prior_fintech boolean not null default false,
  prior_fintech_details text check (char_length(prior_fintech_details) <= 300),
  conflict boolean not null default false,
  conflict_details text check (char_length(conflict_details) <= 300),
  pitch text check (char_length(pitch) <= 2000),
  consent_at timestamptz not null,
  status text not null default 'unverified' check (status in ('unverified', 'pending', 'approved', 'rejected')),
  code_hash text,
  code_expires_at timestamptz,
  code_attempts int not null default 0,
  code_sends int not null default 0,
  last_code_at timestamptz,
  verified_at timestamptz,
  referral_code text,
  invite_token text,
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists creator_applications_email_idx on public.creator_applications (lower(email));
create index if not exists creator_applications_status_idx on public.creator_applications (status, created_at desc);

alter table public.creator_applications enable row level security;
revoke all on public.creator_applications from anon, authenticated;

-- Email / Telegram go out from referral-payout-telegram-notification ({ creatorApp: {...} }).
create or replace function private.creator_app_notify(p_body jsonb)
returns void
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
    raise warning 'Creator application notification skipped: project URL or secret key missing from vault.';
    return;
  end if;
  perform net.http_post(
    url := project_url || '/functions/v1/referral-payout-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('creatorApp', p_body)
  );
end;
$$;
revoke all on function private.creator_app_notify(jsonb) from public, anon, authenticated;

create or replace function private.creator_app_hash(p_id uuid, p_code text)
returns text
language sql
immutable
as $$ select encode(sha256(convert_to(p_id::text || ':' || p_code, 'UTF8')), 'hex') $$;
revoke all on function private.creator_app_hash(uuid, text) from public, anon, authenticated;

-- New code for an unverified application + email it.
create or replace function private.creator_app_send_code(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := lpad((floor(random() * 1000000))::int::text, 6, '0');
begin
  update public.creator_applications
     set code_hash = private.creator_app_hash(id, v_code),
         code_expires_at = now() + interval '15 minutes',
         code_attempts = 0,
         code_sends = code_sends + 1,
         last_code_at = now()
   where id = p_id;
  perform private.creator_app_notify(jsonb_build_object('event', 'code', 'id', p_id, 'code', v_code));
end;
$$;
revoke all on function private.creator_app_send_code(uuid) from public, anon, authenticated;

create or replace function private.creator_app_clean(p text, p_max int)
returns text
language sql
immutable
as $$ select nullif(left(btrim(coalesce(p, '')), p_max), '') $$;
revoke all on function private.creator_app_clean(text, int) from public, anon, authenticated;

-- Step 1: save the form, email a code. Returns the id the page keeps for step 2.
create or replace function public.creator_apply_start(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c text := private.creator_app_clean(p ->> 'email', 200);
  v_email text := lower(c);
  v_id uuid;
begin
  if v_email is null or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'creator_bad_email';
  end if;
  if coalesce((p ->> 'consent')::boolean, false) is not true then
    raise exception 'creator_no_consent';
  end if;
  if exists (select 1 from public.creator_applications where lower(email) = v_email and status in ('pending', 'approved')) then
    raise exception 'creator_already_applied';
  end if;
  -- Abuse caps: 3 tries per email per hour, 60 unverified forms per hour overall.
  if (select count(*) from public.creator_applications where lower(email) = v_email and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.creator_applications where status = 'unverified' and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'creator_too_many';
  end if;

  insert into public.creator_applications (
    full_name, address, phone, email, facebook_url, tiktok_url, youtube_url, instagram_url,
    prior_fintech, prior_fintech_details, conflict, conflict_details, pitch, consent_at
  ) values (
    private.creator_app_clean(p ->> 'full_name', 120),
    private.creator_app_clean(p ->> 'address', 300),
    private.creator_app_clean(p ->> 'phone', 40),
    v_email,
    private.creator_app_clean(p ->> 'facebook_url', 300),
    private.creator_app_clean(p ->> 'tiktok_url', 300),
    private.creator_app_clean(p ->> 'youtube_url', 300),
    private.creator_app_clean(p ->> 'instagram_url', 300),
    coalesce((p ->> 'prior_fintech')::boolean, false),
    private.creator_app_clean(p ->> 'prior_fintech_details', 300),
    coalesce((p ->> 'conflict')::boolean, false),
    private.creator_app_clean(p ->> 'conflict_details', 300),
    private.creator_app_clean(p ->> 'pitch', 2000),
    now()
  ) returning id into v_id;

  perform private.creator_app_send_code(v_id);
  return v_id;
end;
$$;
revoke all on function public.creator_apply_start(jsonb) from public;
grant execute on function public.creator_apply_start(jsonb) to anon, authenticated;

create or replace function public.creator_apply_resend(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.creator_applications%rowtype;
begin
  select * into r from public.creator_applications where id = p_id;
  if not found or r.status <> 'unverified' then
    raise exception 'creator_not_found';
  end if;
  if r.code_sends >= 5 then
    raise exception 'creator_too_many';
  end if;
  if r.last_code_at > now() - interval '60 seconds' then
    raise exception 'creator_wait';
  end if;
  perform private.creator_app_send_code(p_id);
end;
$$;
revoke all on function public.creator_apply_resend(uuid) from public;
grant execute on function public.creator_apply_resend(uuid) to anon, authenticated;

-- Step 2: right code → application number, confirmation email, team card.
create or replace function public.creator_apply_verify(p_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.creator_applications%rowtype;
  v_number text;
  v_year text := to_char(now() at time zone 'Asia/Manila', 'YYYY');
begin
  select * into r from public.creator_applications where id = p_id for update;
  if not found then
    raise exception 'creator_not_found';
  end if;
  if r.status <> 'unverified' then
    return r.app_number; -- double tap
  end if;
  if r.code_attempts >= 5 then
    raise exception 'creator_too_many';
  end if;
  if r.code_expires_at is null or r.code_expires_at < now() then
    raise exception 'creator_code_expired';
  end if;
  if private.creator_app_hash(r.id, btrim(coalesce(p_code, ''))) <> r.code_hash then
    update public.creator_applications set code_attempts = code_attempts + 1 where id = p_id;
    return null; -- wrong code (null, not an error, so the attempt count sticks)
  end if;
  if exists (select 1 from public.creator_applications
              where lower(email) = lower(r.email) and status in ('pending', 'approved') and id <> r.id) then
    raise exception 'creator_already_applied';
  end if;

  loop
    v_number := 'MDG-' || v_year || '-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
    exit when not exists (select 1 from public.creator_applications where app_number = v_number);
  end loop;

  update public.creator_applications
     set status = 'pending', app_number = v_number, verified_at = now(), code_hash = null, code_expires_at = null
   where id = p_id;
  perform private.creator_app_notify(jsonb_build_object('event', 'submitted', 'id', p_id));
  return v_number;
end;
$$;
revoke all on function public.creator_apply_verify(uuid, text) from public;
grant execute on function public.creator_apply_verify(uuid, text) to anon, authenticated;

-- Public status check: needs the number AND the email it was sent to.
create or replace function public.creator_application_status(p_number text, p_email text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'app_number', a.app_number,
    'status', a.status,
    'first_name', split_part(a.full_name, ' ', 1),
    'submitted_at', a.verified_at,
    'partner_link', case when a.status = 'approved' and a.invite_token is not null
                         then 'https://moodeng.app/partner/' || a.invite_token end,
    'code', case when a.status = 'approved' then a.referral_code end
  )
  from public.creator_applications a
  where a.app_number = upper(btrim(coalesce(p_number, '')))
    and lower(a.email) = lower(btrim(coalesce(p_email, '')))
    and a.status <> 'unverified'
$$;
revoke all on function public.creator_application_status(text, text) from public;
grant execute on function public.creator_application_status(text, text) to anon, authenticated;

-- Admin list (verified only).
create or replace function public.admin_creator_applications()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admin only';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(a) - 'code_hash' - 'code_expires_at' - 'code_attempts' - 'code_sends' - 'last_code_at'
                     order by (a.status = 'pending') desc, a.verified_at desc)
      from public.creator_applications a
     where a.status <> 'unverified'
       and (a.status = 'pending' or a.verified_at > now() - interval '120 days')
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_creator_applications() from public, anon;
grant execute on function public.admin_creator_applications() to authenticated;

-- Approve: make (or reuse) the code + one-time /partner link, email it. Reject: email.
create or replace function public.admin_decide_creator_application(p_id uuid, p_decision text, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.creator_applications%rowtype;
  v_token text;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admin only';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected';
  end if;
  select * into r from public.creator_applications where id = p_id for update;
  if not found or r.status = 'unverified' then
    raise exception 'application not found';
  end if;
  if r.status <> 'pending' then
    raise exception 'already %', r.status;
  end if;

  if p_decision = 'approved' then
    v_token := public.admin_create_affiliate_invite(v_code, r.full_name);
    update public.creator_applications
       set status = 'approved', referral_code = v_code, invite_token = v_token, decided_at = now(), decided_by = auth.uid()
     where id = p_id;
  else
    update public.creator_applications
       set status = 'rejected', decided_at = now(), decided_by = auth.uid()
     where id = p_id;
  end if;
  perform private.creator_app_notify(jsonb_build_object('event', p_decision, 'id', p_id));
  return jsonb_build_object('status', p_decision, 'code', nullif(v_code, ''),
    'partner_link', case when v_token is not null then 'https://moodeng.app/partner/' || v_token end);
end;
$$;
revoke all on function public.admin_decide_creator_application(uuid, text, text) from public, anon;
grant execute on function public.admin_decide_creator_application(uuid, text, text) to authenticated;
