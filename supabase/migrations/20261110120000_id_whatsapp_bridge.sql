-- Indonesia track: WhatsApp → Telegram bridge (the new front door from Facebook posts).
--
-- Why: people who leave Facebook's in-app browser for another app don't come back to the page (PostHog,
-- Oct–Nov 2026: 0 of 8 Android people returned after opening WhatsApp, though 5 of 6 real ones did send
-- the message). The Telegram-app sign-in on /id needs exactly that return trip. And most Indonesians have
-- WhatsApp but must install Telegram first.
--
-- How: the /id button opens WhatsApp with a message already typed ("… MDNG-DAFTAR"). They send it, so
-- we may reply freely for 24 hours: install Telegram, then tap a link that opens our bot with
-- /start wa_<token>. Pressing Start ties their Telegram account to this row; when they then join the
-- track (bot button → the site, signed in by Telegram), join_id_track() copies the WhatsApp number onto
-- their account, so the WhatsApp step is already done. Nudges go out on WhatsApp (inside the 24 hours)
-- and on Telegram. Code: supabase/functions/_shared/idWaBridge.ts.
--
-- WhatsApp messages never talk about loans (George, 2026-11-10): they only lead to Telegram.

create table if not exists public.id_wa_bridge (
  id uuid primary key default gen_random_uuid(),
  -- /start wa_<token>
  token text not null unique,
  -- SendPulse WhatsApp contact; one row per person
  contact_id text not null unique,
  phone text,
  locale text not null default 'id',
  -- 'a' Android, 'i' iPhone, null unknown (from the page, inside the typed message)
  os text,
  created_at timestamptz not null default now(),
  -- their last message to us: free replies are allowed for 24h after it
  last_inbound_at timestamptz not null default now(),
  steps_sent_at timestamptz,
  wa_nudges int not null default 0,
  wa_nudged_at timestamptz,
  -- set when they press Start in the bot
  telegram_id bigint,
  telegram_username text,
  started_at timestamptz,
  tg_nudges int not null default 0,
  tg_nudged_at timestamptz,
  -- set when they join the track
  user_id uuid references public.users(id) on delete set null,
  joined_at timestamptz
);

comment on table public.id_wa_bridge is
  'Indonesia sign-ups that started on WhatsApp and are being led to the Telegram bot. Server only.';

create index if not exists id_wa_bridge_telegram_idx on public.id_wa_bridge (telegram_id) where telegram_id is not null;
create index if not exists id_wa_bridge_open_idx on public.id_wa_bridge (last_inbound_at) where user_id is null;

alter table public.id_wa_bridge enable row level security;
revoke all on public.id_wa_bridge from anon, authenticated;

-- ── the switch ─────────────────────────────────────────────────────────────────────────────────
-- off: /id keeps the Telegram button only, and the WhatsApp message gets no bridge reply.
-- test: the bridge answers, but /id shows the WhatsApp button only with ?wa=1 (for the team's phones).
-- on: /id leads with the WhatsApp button.
insert into public.telegram_bot_settings (key, value, description) values
  ('id_wa_bridge', 'test', 'Indonesia track: WhatsApp → Telegram entry on /id. off | test (only with ?wa=1) | on.')
on conflict (key) do nothing;

create or replace function public.get_id_wa_bridge()
returns text language sql stable security definer set search_path = public as $$
  select case when v in ('off', 'test', 'on') then v else 'off' end
  from (select (select value from public.telegram_bot_settings where key = 'id_wa_bridge') as v) s;
$$;

revoke execute on function public.get_id_wa_bridge() from public;
grant execute on function public.get_id_wa_bridge() to anon, authenticated, service_role;

-- ── copying WhatsApp onto the account ──────────────────────────────────────────────────────────
-- The Telegram id comes from auth.users.raw_app_meta_data (set by telegram-login, never by the client;
-- users.telegram_id is client-writable). Only for Indonesia-track accounts. A WhatsApp contact already
-- on another account is left alone. Safe to call again.
create or replace function public.attach_id_wa_bridge(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_tg bigint;
  v_b public.id_wa_bridge%rowtype;
  v_taken boolean;
begin
  select nullif(a.raw_app_meta_data ->> 'telegram_id', '')::bigint into v_tg from auth.users a where a.id = p_user_id;
  if v_tg is null then return false; end if;

  select * into v_b
    from public.id_wa_bridge b
   where b.telegram_id = v_tg and (b.user_id is null or b.user_id = p_user_id)
   order by b.started_at desc nulls last
   limit 1
   for update;
  if not found then return false; end if;

  if not exists (select 1 from public.users u where u.id = p_user_id and u.market = 'ID') then return false; end if;

  select exists (select 1 from public.users o where o.whatsapp_contact_id = v_b.contact_id and o.id <> p_user_id) into v_taken;

  update public.users u
     set chat_id = coalesce(u.chat_id, v_tg),
         telegram_username = coalesce(nullif(trim(coalesce(u.telegram_username, '')), ''), v_b.telegram_username),
         whatsapp_contact_id = case when u.whatsapp_verified_at is null and not v_taken then v_b.contact_id else u.whatsapp_contact_id end,
         whatsapp_number = case when u.whatsapp_verified_at is null and not v_taken then coalesce(v_b.phone, u.whatsapp_number) else u.whatsapp_number end,
         notif_whatsapp = case when u.whatsapp_verified_at is null and not v_taken then true else u.notif_whatsapp end,
         whatsapp_verified_at = case when u.whatsapp_verified_at is null and not v_taken then v_b.last_inbound_at else u.whatsapp_verified_at end
   where u.id = p_user_id;

  update public.id_wa_bridge set user_id = p_user_id, joined_at = coalesce(joined_at, now()) where id = v_b.id;
  return true;
end;
$$;

revoke execute on function public.attach_id_wa_bridge(uuid) from public, anon, authenticated;
grant execute on function public.attach_id_wa_bridge(uuid) to service_role;

-- ── joining the track: same rules as 20261107120000, plus the bridge copy ───────────────────────
create or replace function public.join_id_track()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_track text := public.get_id_track();
  v_user public.users%rowtype;
begin
  select * into v_user from public.users where id = auth.uid() for update;
  if not found then raise exception 'not signed in'; end if;
  if v_user.market = 'ID' then
    perform public.attach_id_wa_bridge(v_user.id);
    return 'ID';
  end if;
  if v_track = 'off' or (v_track = 'test' and not coalesce((to_jsonb(v_user) ->> 'is_test')::boolean, false)) then
    raise exception 'id_track_closed';
  end if;
  if v_user.user_role = 'lender' then raise exception 'lenders cannot join the Indonesia track'; end if;
  if exists (select 1 from public.loans l where l.borrower_user_id = v_user.id) then
    raise exception 'id_track_existing_borrower';
  end if;
  -- Old accounts default to loan_access_status = 'approved' (20260924150000), and the normal flow
  -- can approve before KYC: on this track approval only comes from its own call, after KYC.
  update public.users
     set market = 'ID', market_set_at = now(), user_role = coalesce(user_role, 'borrower'),
         loan_access_status = 'none', loan_access_approved_at = null,
         preferred_locale = coalesce(preferred_locale, 'id'), preferred_locale_at = coalesce(preferred_locale_at, now())
   where id = v_user.id;
  -- Came in through WhatsApp → Telegram: their WhatsApp is already confirmed.
  perform public.attach_id_wa_bridge(v_user.id);
  return 'ID';
end;
$$;
