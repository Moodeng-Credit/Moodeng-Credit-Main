-- Indonesia track: a separate, stricter borrower system for Indonesians (users.market = 'ID').
--
--   Sign-up is Telegram only (the bot messages them about everything). Before the call they must:
--     1. telegram   — the bot can message them (users.chat_id)
--     2. whatsapp   — a verified +62 WhatsApp number (notifications + a human can reach them; no bot)
--     3. facebook   — Messenger code sent to our Page + their Facebook profile link + followed the Page
--     4. about      — income type / payday / income & expenses (OnboardingBio)
--     5. income     — a proof-of-income upload (income_documents), not declined
--     6. kyc        — Didit ID + liveness submitted (approved before the team can ✅ them)
--     7. walt       — their Walt (Telegram wallet) USDC BEP20 address, where loans are sent
--     8. call       — booked the 15-min call → team ✅ (users.loan_access_status = 'approved')
--   Loans are small and short: $5 or $10 (setting id_loan_amounts), due within id_max_term_days (14).
--   Every loan row carries loans.market so lenders, admins and team posts can mark it 🇮🇩.
--
-- Switch: telegram_bot_settings.id_track = 'off' (default) | 'test' (only is_test accounts can join)
-- | 'on'. Turning it off stops NEW sign-ups joining the track; people already on it keep their rules.

-- ── columns ────────────────────────────────────────────────────────────────────────────────────
alter table public.users add column if not exists market text check (market in ('ID'));
alter table public.users add column if not exists market_set_at timestamptz;
alter table public.users add column if not exists facebook_profile_url text;
alter table public.users add column if not exists facebook_page_followed_at timestamptz;
alter table public.users add column if not exists walt_address text check (walt_address ~ '^0x[0-9a-fA-F]{40}$');
alter table public.users add column if not exists walt_address_set_at timestamptz;

comment on column public.users.market is 'ID = Indonesia track (Telegram-first onboarding, $5/$10 loans, Walt payouts). Null = default flow.';
comment on column public.users.walt_address is 'Borrower''s Walt (Telegram wallet) USDC BEP20 deposit address. Loans are bridged Base → BNB Chain to it.';

alter table public.loans add column if not exists market text check (market in ('ID'));
comment on column public.loans.market is 'Copied from users.market when the request is created. ID = Indonesian borrower (shown with a 🇮🇩 mark).';

create index if not exists users_market_idx on public.users (market) where market is not null;

insert into public.telegram_bot_settings (key, value, description) values
  ('id_track', 'off', 'Indonesia track: off | test (is_test accounts only) | on. Controls who can JOIN the track.'),
  ('id_loan_amounts', '5,10', 'Indonesia track: allowed loan amounts in USD, comma separated.'),
  ('id_max_term_days', '14', 'Indonesia track: longest loan term in days.')
on conflict (key) do nothing;

-- ── settings readers ───────────────────────────────────────────────────────────────────────────
create or replace function public.get_id_track()
returns text language sql stable security definer set search_path = public as $$
  select case when v in ('off', 'test', 'on') then v else 'off' end
  from (select (select value from public.telegram_bot_settings where key = 'id_track') as v) s;
$$;

create or replace function public.get_id_loan_rules()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'amounts', coalesce((
      select jsonb_agg(a::numeric order by a::numeric)
      from unnest(string_to_array(coalesce((select value from public.telegram_bot_settings where key = 'id_loan_amounts'), '5,10'), ',')) a
      where trim(a) ~ '^[0-9]+(\.[0-9]{1,2})?$'
    ), '[5,10]'::jsonb),
    'maxTermDays', coalesce(nullif((select value from public.telegram_bot_settings where key = 'id_max_term_days'), '')::int, 14)
  );
$$;

-- ── joining the track ──────────────────────────────────────────────────────────────────────────
-- Called by the app when an Indonesian signs up through /id. Only a fresh borrower can join (no
-- loans yet), only while the switch allows it, and joining is one-way from the app (admins can
-- clear it in SQL).
create or replace function public.join_id_track()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_track text := public.get_id_track();
  v_user public.users%rowtype;
begin
  select * into v_user from public.users where id = auth.uid() for update;
  if not found then raise exception 'not signed in'; end if;
  if v_user.market = 'ID' then return 'ID'; end if;
  if v_track = 'off' or (v_track = 'test' and not coalesce((to_jsonb(v_user) ->> 'is_test')::boolean, false)) then
    raise exception 'id_track_closed';
  end if;
  if v_user.user_role = 'lender' then raise exception 'lenders cannot join the Indonesia track'; end if;
  if exists (select 1 from public.loans l where l.borrower_user_id = v_user.id) then
    raise exception 'id_track_existing_borrower';
  end if;
  update public.users
     set market = 'ID', market_set_at = now(), user_role = coalesce(user_role, 'borrower'),
         preferred_locale = coalesce(preferred_locale, 'id'), preferred_locale_at = coalesce(preferred_locale_at, now())
   where id = v_user.id;
  return 'ID';
end;
$$;

-- ── steps the borrower fills in ────────────────────────────────────────────────────────────────
create or replace function public.save_my_facebook_profile(p_url text, p_followed boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text := trim(coalesce(p_url, ''));
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if v_url !~* '^(https?://)?([a-z0-9-]+\.)?(facebook\.com|fb\.com|fb\.me)/[^\s]{2,}$' then
    raise exception 'facebook_profile_invalid';
  end if;
  if v_url !~* '^https?://' then v_url := 'https://' || v_url; end if;
  if not coalesce(p_followed, false) then raise exception 'facebook_follow_required'; end if;
  update public.users
     set facebook_profile_url = left(v_url, 300),
         facebook_page_followed_at = coalesce(facebook_page_followed_at, now())
   where id = auth.uid();
end;
$$;

create or replace function public.save_my_walt_address(p_address text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_addr text := trim(coalesce(p_address, ''));
  v_wallet text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if v_addr !~ '^0x[0-9a-fA-F]{40}$' then raise exception 'walt_address_invalid'; end if;
  select wallet_address into v_wallet from public.users where id = auth.uid();
  if lower(v_addr) = lower(coalesce(v_wallet, '')) then raise exception 'walt_address_is_moodeng_wallet'; end if;
  if lower(v_addr) = '0x0000000000000000000000000000000000000000' then raise exception 'walt_address_invalid'; end if;
  -- One Walt address per person: a second account pointing at the same wallet is a fraud signal.
  if exists (select 1 from public.users u where lower(u.walt_address) = lower(v_addr) and u.id <> auth.uid()) then
    raise exception 'walt_address_in_use';
  end if;
  update public.users set walt_address = v_addr, walt_address_set_at = now() where id = auth.uid();
end;
$$;

-- ── where is this borrower? (one source of truth for the app, the bot and the server checks) ──
create or replace function public.id_onboarding_status(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with u as (select * from public.users where id = p_user_id),
  doc as (
    select d.decision, d.verdict, d.created_at
    from public.income_documents d where d.user_id = p_user_id
    order by d.created_at desc limit 1
  ),
  s as (
    select
      u.market,
      u.chat_id is not null as telegram,
      coalesce(u.whatsapp_verified_at is not null and regexp_replace(coalesce(u.whatsapp_number, ''), '\D', '', 'g') like '62%', false) as whatsapp,
      (u.messenger_verified_at is not null and u.facebook_profile_url is not null and u.facebook_page_followed_at is not null) as facebook,
      (u.messenger_verified_at is not null) as messenger,
      (u.facebook_profile_url is not null and u.facebook_page_followed_at is not null) as facebook_profile,
      (u.income_type is not null) as about,
      exists (select 1 from doc where doc.decision is distinct from 'declined') as income,
      coalesce((select doc.decision from doc), case when (select doc.verdict from doc) = 'resend' then 'resend' end) as income_state,
      coalesce(u.is_didit = 'ACTIVE', false) as kyc_approved,
      coalesce(u.is_didit = 'ACTIVE'
        or lower(coalesce(u.didit_id_status, '')) like '%review%'
        or (u.didit_submitted_at is not null
            and lower(coalesce(u.didit_id_status, '')) not in ('duplicate', 'declined', 'abandoned', 'expired', 'not started', 'in progress')), false) as kyc,
      lower(coalesce(u.didit_id_status, '')) as kyc_state,
      u.walt_address is not null as walt,
      coalesce(u.video_call_scheduled_at is not null or u.loan_access_status in ('pending', 'approved'), false) as call,
      coalesce(u.loan_access_status, 'none') as access
    from u
  )
  select case when s.market is distinct from 'ID' then jsonb_build_object('market', null)
  else jsonb_build_object(
    'market', 'ID',
    'steps', jsonb_build_object(
      'telegram', s.telegram, 'whatsapp', s.whatsapp, 'facebook', s.facebook, 'about', s.about,
      'income', s.income, 'kyc', s.kyc, 'walt', s.walt, 'call', s.call),
    'messenger', s.messenger,
    'facebookProfile', s.facebook_profile,
    'incomeState', s.income_state,
    'kycApproved', s.kyc_approved,
    'kycState', s.kyc_state,
    'access', s.access,
    -- KYC can start once everything before it is done.
    'readyForKyc', s.telegram and s.whatsapp and s.facebook and s.about and s.income,
    -- The call can be booked once everything before it is done (KYC submitted is enough to book;
    -- the team only ✅s once KYC is approved).
    'readyForCall', s.telegram and s.whatsapp and s.facebook and s.about and s.income and s.kyc and s.walt,
    'next', case
      when not s.telegram then 'telegram'
      when not s.whatsapp then 'whatsapp'
      when not s.facebook then 'facebook'
      when not s.about then 'about'
      when not s.income then 'income'
      when not s.kyc then 'kyc'
      when not s.walt then 'walt'
      when not s.call then 'call'
      when s.access = 'approved' then 'apply'
      else 'waiting' end)
  end
  from s;
$$;

create or replace function public.my_id_onboarding()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(public.id_onboarding_status(auth.uid()), jsonb_build_object('market', null))
         || jsonb_build_object('track', public.get_id_track(), 'rules', public.get_id_loan_rules());
$$;

-- ── the old pre-KYC gate (Messenger → bio → call → ✅ → KYC) does not apply to the ID track: it
--    runs KYC BEFORE the call, and its own order is enforced by id_onboarding_status. ────────────
create or replace function public.needs_pre_kyc_gate(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  SELECT public.get_kyc_gate()
     AND u.market IS DISTINCT FROM 'ID'
     AND u.user_role IS DISTINCT FROM 'lender'
     AND u.is_didit IS DISTINCT FROM 'ACTIVE'
     AND u.is_world_id IS DISTINCT FROM 'ACTIVE'
     AND (to_jsonb(u) ->> 'is_world_id_passport') IS DISTINCT FROM 'ACTIVE'
     AND u.loan_access_status IS DISTINCT FROM 'approved'
     AND NOT EXISTS (SELECT 1 FROM public.loans l WHERE l.borrower_user_id = u.id AND l.funded_at IS NOT NULL)
     AND lower(coalesce(u.didit_id_status, '')) IS DISTINCT FROM 'duplicate'
     AND NOT (lower(coalesce(u.didit_id_status, '')) LIKE '%review%'
              OR (u.didit_submitted_at IS NOT NULL
                  AND lower(coalesce(u.didit_id_status, '')) NOT IN
                      ('duplicate', 'declined', 'abandoned', 'expired', 'not started', 'in progress')))
  FROM public.users u
  WHERE u.id = p_user_id;
$$;

-- ── loan rules for the ID track ────────────────────────────────────────────────────────────────
create or replace function app_private.set_loan_market()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select u.market into new.market from public.users u where u.id = new.borrower_user_id;
  return new;
end;
$$;

drop trigger if exists trg_set_loan_market on public.loans;
create trigger trg_set_loan_market before insert on public.loans
  for each row execute function app_private.set_loan_market();

-- Clients can't relabel a loan afterwards.
create or replace function app_private.keep_loan_market()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.market := old.market;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_keep_loan_market on public.loans;
create trigger trg_keep_loan_market before update of market on public.loans
  for each row execute function app_private.keep_loan_market();

create or replace function app_private.enforce_new_loan_terms()
returns trigger language plpgsql set search_path to '' as $function$
declare
  v_market text;
  v_access text;
  v_rules jsonb;
  v_max_days int;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if new.total_repayment_amount is null or new.total_repayment_amount < new.loan_amount then
    raise exception 'loans: the repayment total can''t be less than the amount borrowed';
  end if;
  if new.total_repayment_amount < new.loan_amount + 1 then
    raise exception 'loans: the repayment must be at least $1 more than the amount borrowed';
  end if;
  if new.loan_amount <> round(new.loan_amount, 2) or new.total_repayment_amount <> round(new.total_repayment_amount, 2) then
    raise exception 'loans: amounts must be in whole cents';
  end if;
  if new.due_date is null or new.due_date < now() - interval '2 days' or new.due_date > now() + interval '122 days' then
    raise exception 'loans: the repayment date must be between today and 120 days from now';
  end if;

  select u.market, u.loan_access_status into v_market, v_access
  from public.users u where u.id = new.borrower_user_id;
  if v_market = 'ID' then
    v_rules := public.get_id_loan_rules();
    v_max_days := (v_rules ->> 'maxTermDays')::int;
    if v_access is distinct from 'approved' then
      raise exception 'loans: finish your Indonesia onboarding and call before requesting a loan';
    end if;
    if not exists (select 1 from jsonb_array_elements_text(v_rules -> 'amounts') a where a::numeric = new.loan_amount) then
      raise exception 'loans: Indonesia loans can only be %', (select string_agg('$' || a, ' or ') from jsonb_array_elements_text(v_rules -> 'amounts') a);
    end if;
    -- +1 day of slack: due_date is midnight UTC of the borrower's local date.
    if new.due_date > now() + make_interval(days => v_max_days + 1) then
      raise exception 'loans: Indonesia loans must be repaid within % days', v_max_days;
    end if;
    if new.total_repayment_amount > new.loan_amount * 1.5 then
      raise exception 'loans: the repayment can be at most 1.5× the amount borrowed';
    end if;
  end if;

  new.credit_limit_at_repayment := null;
  new.refunded_at := null;
  new.refund_reason := null;
  new.refunded_by := null;
  new.refund_hash := null;
  new.offplatform_settlement_note := null;
  return new;
end;
$function$;

-- ── Base ↔ BNB Chain transfers through Relay (Walt cash-out and repay-from-Walt) ────────────────
create table if not exists public.relay_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  direction text not null check (direction in ('cashout', 'repay')),
  origin_chain_id integer not null,
  destination_chain_id integer not null,
  origin_token text not null,
  destination_token text not null,
  amount_in numeric not null,             -- in token units (USDC 6dp on Base; USDT 18dp on BSC)
  amount_out_quoted numeric,              -- human units of the destination token
  deposit_address text not null,          -- Relay's one-time address the money is sent to
  recipient text not null,                -- Walt address (cashout) or Moodeng wallet (repay)
  refund_to text,
  request_id text,
  status text not null default 'quoted',  -- quoted → sent → success | failure | refund | expired
  tx_hash text,                           -- the send into the deposit address (cashout)
  fill_tx_hash text,                      -- Relay's delivery on the other chain
  loan_id uuid,
  quote jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists relay_transfers_user_idx on public.relay_transfers (user_id, created_at desc);
create unique index if not exists relay_transfers_deposit_idx on public.relay_transfers (lower(deposit_address));

alter table public.relay_transfers enable row level security;
drop policy if exists relay_transfers_own_read on public.relay_transfers;
create policy relay_transfers_own_read on public.relay_transfers for select to authenticated
  using (user_id = auth.uid());
-- Writes only through the edge function (service role).

-- ── the new users columns are server-only (no client UPDATE grant is added for them; this also
--    blanks them on a client INSERT of the profile row) ─────────────────────────────────────────
create or replace function app_private.reset_id_track_columns_on_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.market := null;
    new.market_set_at := null;
    new.facebook_profile_url := null;
    new.facebook_page_followed_at := null;
    new.walt_address := null;
    new.walt_address_set_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_reset_id_track_columns_on_insert on public.users;
create trigger trg_reset_id_track_columns_on_insert before insert on public.users
  for each row execute function app_private.reset_id_track_columns_on_insert();

-- ── grants ─────────────────────────────────────────────────────────────────────────────────────
revoke execute on function public.get_id_track() from public;
revoke execute on function public.get_id_loan_rules() from public;
revoke execute on function public.join_id_track() from public, anon;
revoke execute on function public.save_my_facebook_profile(text, boolean) from public, anon;
revoke execute on function public.save_my_walt_address(text) from public, anon;
revoke execute on function public.id_onboarding_status(uuid) from public, anon, authenticated;
revoke execute on function public.my_id_onboarding() from public, anon;
grant execute on function public.get_id_track() to anon, authenticated;
grant execute on function public.get_id_loan_rules() to anon, authenticated;
grant execute on function public.join_id_track() to authenticated;
grant execute on function public.save_my_facebook_profile(text, boolean) to authenticated;
grant execute on function public.save_my_walt_address(text) to authenticated;
grant execute on function public.my_id_onboarding() to authenticated;
grant execute on function public.id_onboarding_status(uuid) to service_role;
