-- Moo-Spin: a prize wheel that brings people back to moodeng.app (2026-11-22).
--
-- How a spin is earned (one row in spin_tickets each):
--   welcome   every approved PH account gets one, once. It always wins something (no "try again").
--   campaign  a Facebook post / video / announcement the team makes in Admin → Spin wheel. The person
--             opens moodeng.app/spin/CODE, reads or watches it, answers its question → one spin per
--             campaign. Messenger "SPIN" replies with that link (and their message reopens the 24 hours).
--   extra     the "Spin again" prize: another spin, ready 20 hours later (so they come back tomorrow).
--
-- Prizes (the server draws; the wheel only animates to the result):
--   grab100   ₱100 voucher now (GrabMart or 2 food links). Rare, from the weekly pot.
--   food50    ₱50 food link now. From the weekly pot.
--   locked50  ₱50 food link that unlocks when their NEXT loan (funded after the spin) is repaid on time,
--             by the same rule as the streak vouchers (loan_counts_for_vouchers: second half of the term).
--             It only costs money after a loan earned us interest. Weekly cap too.
--   extra     another spin tomorrow.  none  try again.
--
-- Money rules: a weekly pot (Monday, Bangkok) caps every prize that costs money; a sold-out prize can't
-- be drawn (the wheel greys it out). One cash prize (grab100/food50) per person per 30 days. The odds,
-- the pot and the switch live in telegram_bot_settings 'spin_wheel' (Admin → Spin wheel edits them).
-- Odds favour new borrowers (never borrowed / first loan) and comeback borrowers (repaid, idle 14+ days).
--
-- Who can spin: approved, active, not ghosted/blocked, not Indonesia, no overdue loan. mode 'team' (the
-- starting mode) lets only the team spin, and team spins are tests: they don't touch the pot and can't be
-- claimed. mode 'on' opens it to borrowers, 'off' closes it.
--
-- Claims: claim_spin_prize() inserts a voucher_claims row (reward 'spin_win') that the usual pipeline sends.
-- spins.voucher_claim_id links the two, so a person can win the same prize many times.

-- ── voucher_claims accepts spin wins ─────────────────────────────────────────────────────────────────
alter table public.voucher_claims drop constraint if exists voucher_claims_reward;
alter table public.voucher_claims add constraint voucher_claims_reward check (
  reward = any (array['first_on_time_repayment', 'referral_inviter', 'referral_invitee',
                      'tier_rising', 'tier_prime', 'tier_apex', 'streak_3', 'streak_5',
                      'affiliate_payout', 'spin_win'])
);

-- ── tables ───────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.spin_campaigns (
  code text primary key check (code ~ '^[A-Z0-9]{3,20}$'),
  title text not null check (char_length(title) between 2 and 120),
  body text check (char_length(body) <= 2000),
  video_url text check (video_url is null or video_url ~* '^https://'),
  question text check (char_length(question) <= 200),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  answer_index integer,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  active boolean not null default true,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spin_campaigns_answer check (
    question is null
    or (answer_index is not null and answer_index >= 0 and answer_index < jsonb_array_length(options))
  )
);

create table if not exists public.spin_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  source text not null check (source in ('welcome', 'campaign', 'extra')),
  campaign_code text references public.spin_campaigns (code),
  available_at timestamptz not null default now(),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint spin_tickets_campaign check (source <> 'campaign' or campaign_code is not null)
);

create unique index if not exists spin_tickets_welcome_once on public.spin_tickets (user_id) where source = 'welcome';
create unique index if not exists spin_tickets_campaign_once on public.spin_tickets (user_id, campaign_code) where source = 'campaign';
create index if not exists spin_tickets_ready on public.spin_tickets (user_id, available_at) where used_at is null;

create table if not exists public.spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  ticket_id uuid not null unique references public.spin_tickets (id) on delete cascade,
  source text not null,
  campaign_code text,
  segment text not null check (segment in ('new', 'comeback', 'regular')),
  prize text not null check (prize in ('grab100', 'food50', 'locked50', 'extra', 'none')),
  amount_php numeric check (amount_php is null or amount_php > 0),
  is_test boolean not null default false,
  expires_at timestamptz,
  voucher_claim_id uuid unique references public.voucher_claims (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists spins_user on public.spins (user_id, created_at desc);
create index if not exists spins_week on public.spins (created_at, prize) where not is_test;

alter table public.spin_campaigns enable row level security;
alter table public.spin_tickets enable row level security;
alter table public.spins enable row level security;
revoke all on public.spin_campaigns, public.spin_tickets, public.spins from anon, authenticated;

-- ── config ───────────────────────────────────────────────────────────────────────────────────────────
create or replace function app_private.spin_default_config()
returns jsonb
language sql
immutable
set search_path to ''
as $function$
  select jsonb_build_object(
    'mode', 'team',
    'pot', jsonb_build_object('grab100', 5, 'food50', 10, 'locked50', 40),
    'cash_cooldown_days', 30,
    'claim_days', 14,
    'unlock_days', 75,
    'extra_after_hours', 20,
    'odds', jsonb_build_object(
      'new',      jsonb_build_object('grab100', 5, 'food50', 10, 'locked50', 30, 'extra', 20, 'none', 35),
      'comeback', jsonb_build_object('grab100', 3, 'food50', 7,  'locked50', 40, 'extra', 15, 'none', 35),
      'regular',  jsonb_build_object('grab100', 2, 'food50', 4,  'locked50', 10, 'extra', 25, 'none', 59)
    )
  );
$function$;

create or replace function app_private.spin_config()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select app_private.spin_default_config() || coalesce((
    select case when s.value ~ '^\s*\{' then s.value::jsonb else '{}'::jsonb end
    from public.telegram_bot_settings s where s.key = 'spin_wheel'
  ), '{}'::jsonb);
$function$;

insert into public.telegram_bot_settings (key, value, description, updated_at)
values ('spin_wheel', app_private.spin_default_config()::text,
        'Moo-Spin wheel: mode off|team|on, weekly pot, odds per segment. Edit in Admin → Spin wheel.', now())
on conflict (key) do nothing;

-- ── who, and which odds ──────────────────────────────────────────────────────────────────────────────
-- Team spins (mode team, or a test account) are practice: no pot, no claim.
create or replace function app_private.spin_is_test(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce((select u.is_test from public.users u where u.id = p_user_id), false)
      or exists (select 1 from public.admin_users au where au.user_id = p_user_id and au.active);
$function$;

-- Null when they may spin, else why not: off | not_approved | blocked | not_ph | overdue.
create or replace function app_private.spin_block_reason(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with cfg as (select app_private.spin_config() ->> 'mode' as mode),
  u as (select * from public.users where id = p_user_id),
  team as (select exists (select 1 from public.admin_users au where au.user_id = p_user_id and au.active) as yes)
  select case
    when not exists (select 1 from u) then 'not_approved'
    when (select mode from cfg) = 'off' then 'off'
    when (select mode from cfg) = 'team' and not (select yes from team) then 'off'
    when (select yes from team) then null
    when (select account_status::text from u) is distinct from 'active'
      or (select ghosted_at from u) is not null
      or (select blocked_for_good_at from u) is not null
      or exists (select 1 from app_private.voucher_blocked_users b where b.user_id = p_user_id) then 'blocked'
    when (select market::text from u) = 'ID' then 'not_ph'
    when (select loan_access_status::text from u) is distinct from 'approved' then 'not_approved'
    when app_private.has_overdue_loan(p_user_id) then 'overdue'
    else null
  end;
$function$;

-- new: never borrowed, or on their first loan. comeback: repaid everything, last repayment 14+ days ago.
create or replace function app_private.spin_segment(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with l as (
    select * from public.loans
    where borrower_user_id = p_user_id and funded_at is not null and refunded_at is null and not coalesce(is_test, false)
  )
  select case
    when (select count(*) from l) <= 1 then 'new'
    when not exists (select 1 from l where loan_status = 'Lent' and coalesce(repayment_status::text, 'Unpaid') <> 'Paid')
     and (select max(coalesce(repaid_at, updated_at)) from l) < now() - interval '14 days' then 'comeback'
    else 'regular'
  end;
$function$;

-- A locked prize opens once a loan funded after the spin is repaid in full, on time, and counts for
-- food vouchers (the halfway rule).
create or replace function app_private.spin_unlocked(p_user_id uuid, p_spun_at timestamptz)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1 from public.loans l
    where l.borrower_user_id = p_user_id
      and l.funded_at > p_spun_at
      and l.repayment_status = 'Paid'
      and l.refunded_at is null
      and not coalesce(l.is_test, false)
      and case when coalesce(l.total_repayment_amount, 0) > 0 then coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
               else coalesce(l.repaid_amount, 0) > 0 end
      and coalesce(l.repaid_at, l.updated_at) < app_private.loan_past_due_at(l)
      and app_private.loan_counts_for_vouchers(l)
  );
$function$;

create or replace function app_private.spin_week_start()
returns timestamptz
language sql
stable
set search_path to ''
as $function$
  select date_trunc('week', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
$function$;

-- What is left in this week's pot.
create or replace function app_private.spin_pot_left()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  with cfg as (select app_private.spin_config() -> 'pot' as pot),
  used as (
    select prize, count(*) as n from public.spins
    where not is_test and created_at >= app_private.spin_week_start() and prize in ('grab100', 'food50', 'locked50')
    group by prize
  )
  select jsonb_object_agg(k, greatest(coalesce((cfg.pot ->> k)::int, 0) - coalesce((select n from used where prize = k), 0), 0))
  from cfg, unnest(array['grab100', 'food50', 'locked50']) as k;
$function$;

-- Weighted draw. Unknown or negative weights count as 0; nothing left → 'none'.
create or replace function app_private.spin_pick(p_weights jsonb)
returns text
language plpgsql
volatile
set search_path to ''
as $function$
declare
  v_keys text[] := array['grab100', 'food50', 'locked50', 'extra', 'none'];
  v_key text;
  v_total numeric := 0;
  v_roll numeric;
begin
  foreach v_key in array v_keys loop
    v_total := v_total + greatest(coalesce((p_weights ->> v_key)::numeric, 0), 0);
  end loop;
  if v_total <= 0 then
    return 'none';
  end if;
  v_roll := random() * v_total;
  foreach v_key in array v_keys loop
    v_roll := v_roll - greatest(coalesce((p_weights ->> v_key)::numeric, 0), 0);
    if v_roll < 0 then
      return v_key;
    end if;
  end loop;
  return 'none';
end;
$function$;

-- The weights for one draw after the pot, the cash cooldown and the welcome guarantee.
create or replace function app_private.spin_weights(p_user_id uuid, p_segment text, p_source text, p_is_test boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_cfg jsonb := app_private.spin_config();
  v_w jsonb := coalesce(v_cfg -> 'odds' -> p_segment, app_private.spin_default_config() -> 'odds' -> p_segment);
  v_left jsonb := app_private.spin_pot_left();
  v_cash_ok boolean;
begin
  if p_source = 'welcome' then
    v_w := v_w || '{"extra": 0, "none": 0}'::jsonb;
  end if;
  if not p_is_test then
    v_cash_ok := not exists (
      select 1 from public.spins s
      where s.user_id = p_user_id and not s.is_test and s.prize in ('grab100', 'food50')
        and s.created_at > now() - make_interval(days => coalesce((v_cfg ->> 'cash_cooldown_days')::int, 30))
    );
    if not v_cash_ok or (v_left ->> 'grab100')::int <= 0 then v_w := v_w || '{"grab100": 0}'::jsonb; end if;
    if not v_cash_ok or (v_left ->> 'food50')::int <= 0 then v_w := v_w || '{"food50": 0}'::jsonb; end if;
    if (v_left ->> 'locked50')::int <= 0 then v_w := v_w || '{"locked50": 0}'::jsonb; end if;
  end if;
  -- A welcome spin with every prize sold out still gets something: another spin.
  if p_source = 'welcome'
     and coalesce((v_w ->> 'grab100')::numeric, 0) + coalesce((v_w ->> 'food50')::numeric, 0) + coalesce((v_w ->> 'locked50')::numeric, 0) <= 0 then
    v_w := v_w || '{"extra": 1}'::jsonb;
  end if;
  return v_w;
end;
$function$;

-- Status of one spin for the app: claimable | locked | claimed | expired | nothing | test.
create or replace function app_private.spin_status(p_spin public.spins)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
    when p_spin.prize in ('extra', 'none') then 'nothing'
    when p_spin.voucher_claim_id is not null then 'claimed'
    when p_spin.is_test then 'test'
    when p_spin.prize = 'locked50' then
      case when app_private.spin_unlocked(p_spin.user_id, p_spin.created_at)
             and now() < p_spin.expires_at + make_interval(days => coalesce((app_private.spin_config() ->> 'claim_days')::int, 14)) then 'claimable'
           when now() >= p_spin.expires_at then 'expired'
           else 'locked' end
    when now() >= p_spin.expires_at then 'expired'
    else 'claimable'
  end;
$function$;

revoke all on function app_private.spin_default_config() from public;
revoke all on function app_private.spin_config() from public;
revoke all on function app_private.spin_is_test(uuid) from public;
revoke all on function app_private.spin_block_reason(uuid) from public;
revoke all on function app_private.spin_segment(uuid) from public;
revoke all on function app_private.spin_unlocked(uuid, timestamptz) from public;
revoke all on function app_private.spin_week_start() from public;
revoke all on function app_private.spin_pot_left() from public;
revoke all on function app_private.spin_pick(jsonb) from public;
revoke all on function app_private.spin_weights(uuid, text, text, boolean) from public;
revoke all on function app_private.spin_status(public.spins) from public;

-- ── borrower RPCs ────────────────────────────────────────────────────────────────────────────────────
-- Everything the /spin page shows. Also hands out the welcome spin the first time an eligible person looks.
create or replace function public.get_spin_state(p_campaign text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_reason text;
  v_campaign public.spin_campaigns;
  v_code text := upper(nullif(btrim(coalesce(p_campaign, '')), ''));
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_reason := app_private.spin_block_reason(v_uid);
  if v_reason is null then
    insert into public.spin_tickets (user_id, source) values (v_uid, 'welcome')
    on conflict (user_id) where source = 'welcome' do nothing;
  end if;
  if v_code is not null then
    select * into v_campaign from public.spin_campaigns c
    where c.code = v_code and c.active and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now());
  end if;

  return jsonb_build_object(
    'blocked', v_reason,
    'test', app_private.spin_is_test(v_uid),
    'segment', app_private.spin_segment(v_uid),
    'ready', (select count(*) from public.spin_tickets t where t.user_id = v_uid and t.used_at is null and t.available_at <= now()),
    'nextAt', (select min(t.available_at) from public.spin_tickets t where t.user_id = v_uid and t.used_at is null and t.available_at > now()),
    'welcomeReady', exists (select 1 from public.spin_tickets t where t.user_id = v_uid and t.source = 'welcome' and t.used_at is null),
    'potLeft', app_private.spin_pot_left(),
    'campaign', case when v_campaign.code is null then null else jsonb_build_object(
      'code', v_campaign.code, 'title', v_campaign.title, 'body', v_campaign.body, 'videoUrl', v_campaign.video_url,
      'question', v_campaign.question, 'options', v_campaign.options,
      'done', exists (select 1 from public.spin_tickets t where t.user_id = v_uid and t.campaign_code = v_campaign.code)
    ) end,
    'campaignMissing', v_code is not null and v_campaign.code is null,
    'prizes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'prize', s.prize, 'amountPhp', s.amount_php, 'createdAt', s.created_at,
        'expiresAt', s.expires_at, 'status', app_private.spin_status(s)
      ) order by s.created_at desc)
      from public.spins s
      where s.user_id = v_uid and s.prize in ('grab100', 'food50', 'locked50') and s.created_at > now() - interval '120 days'
    ), '[]'::jsonb)
  );
end;
$function$;

-- Read / watch the campaign, answer its question → one spin for that campaign.
create or replace function public.answer_spin_campaign(p_code text, p_answer integer default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_reason text;
  v_campaign public.spin_campaigns;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_reason := app_private.spin_block_reason(v_uid);
  if v_reason is not null then
    return jsonb_build_object('ok', false, 'error', v_reason);
  end if;
  select * into v_campaign from public.spin_campaigns c
  where c.code = upper(btrim(coalesce(p_code, ''))) and c.active and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now());
  if v_campaign.code is null then
    return jsonb_build_object('ok', false, 'error', 'campaign_over');
  end if;
  if v_campaign.question is not null and p_answer is distinct from v_campaign.answer_index then
    return jsonb_build_object('ok', false, 'error', 'wrong_answer');
  end if;
  insert into public.spin_tickets (user_id, source, campaign_code) values (v_uid, 'campaign', v_campaign.code)
  on conflict (user_id, campaign_code) where source = 'campaign' do nothing;
  return jsonb_build_object('ok', true);
end;
$function$;

-- One spin: uses their oldest ready ticket, draws under the pot lock, records it.
create or replace function public.spin_wheel()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_reason text;
  v_ticket public.spin_tickets;
  v_test boolean;
  v_segment text;
  v_cfg jsonb := app_private.spin_config();
  v_prize text;
  v_amount numeric;
  v_expires timestamptz;
  v_spin_id uuid;
  v_next timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_reason := app_private.spin_block_reason(v_uid);
  if v_reason is not null then
    return jsonb_build_object('error', v_reason);
  end if;

  -- One draw at a time across everyone, so two spins can't both take the last prize in the pot.
  perform pg_advisory_xact_lock(hashtext('moodeng_spin_wheel_pot'));

  select * into v_ticket from public.spin_tickets t
  where t.user_id = v_uid and t.used_at is null and t.available_at <= now()
  order by (t.source = 'welcome') desc, t.available_at, t.created_at
  limit 1
  for update;
  if v_ticket.id is null then
    return jsonb_build_object('error', 'no_spin');
  end if;

  v_test := app_private.spin_is_test(v_uid);
  v_segment := app_private.spin_segment(v_uid);
  v_prize := app_private.spin_pick(app_private.spin_weights(v_uid, v_segment, v_ticket.source, v_test));
  v_amount := case v_prize when 'grab100' then 100 when 'food50' then 50 when 'locked50' then 50 end;
  v_expires := case
    when v_prize in ('grab100', 'food50') then now() + make_interval(days => coalesce((v_cfg ->> 'claim_days')::int, 14))
    when v_prize = 'locked50' then now() + make_interval(days => coalesce((v_cfg ->> 'unlock_days')::int, 75))
  end;

  insert into public.spins (user_id, ticket_id, source, campaign_code, segment, prize, amount_php, is_test, expires_at)
  values (v_uid, v_ticket.id, v_ticket.source, v_ticket.campaign_code, v_segment, v_prize, v_amount, v_test, v_expires)
  returning id into v_spin_id;

  update public.spin_tickets set used_at = now() where id = v_ticket.id;

  if v_prize = 'extra' then
    v_next := now() + make_interval(hours => coalesce((v_cfg ->> 'extra_after_hours')::int, 20));
    insert into public.spin_tickets (user_id, source, available_at) values (v_uid, 'extra', v_next);
  end if;

  return jsonb_build_object(
    'spinId', v_spin_id, 'prize', v_prize, 'amountPhp', v_amount, 'expiresAt', v_expires,
    'nextAt', v_next, 'test', v_test, 'segment', v_segment
  );
end;
$function$;

-- Claim a won (or unlocked) prize: becomes a voucher_claims row that the usual pipeline sends.
create or replace function public.claim_spin_prize(
  p_spin_id uuid, p_full_name text, p_mobile text, p_email text, p_brand text default 'food'
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_spin public.spins;
  v_status text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if app_private.has_overdue_loan(v_uid) then
    raise exception 'overdue loan: repay your loan to claim vouchers' using errcode = '42501';
  end if;
  select * into v_spin from public.spins where id = p_spin_id and user_id = v_uid for update;
  if v_spin.id is null then
    raise exception 'not eligible for this voucher' using errcode = '42501';
  end if;
  v_status := app_private.spin_status(v_spin);
  if v_status = 'test' then
    raise exception 'team test spin: nothing is sent' using errcode = '42501';
  end if;
  if v_status = 'claimed' then
    raise exception 'voucher already claimed' using errcode = '23505';
  end if;
  if v_status <> 'claimable' then
    raise exception 'not eligible for this voucher' using errcode = '42501';
  end if;
  if exists (select 1 from app_private.voucher_blocked_users b where b.user_id = v_uid) then
    raise exception 'not eligible for this voucher' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_email, '')), '') is null then
    raise exception 'email required: the voucher is emailed' using errcode = '22023';
  end if;
  if coalesce(p_brand, 'food') not in ('food', 'grabmart') then
    raise exception 'unknown brand %', p_brand using errcode = '22023';
  end if;
  if p_brand = 'grabmart' and v_spin.amount_php < 100 then
    raise exception 'grabmart needs 100: GrabMart vouchers start at PHP 100' using errcode = '22023';
  end if;

  insert into public.voucher_claims (user_id, reward, amount_php, full_name, mobile, email, brand)
  values (v_uid, 'spin_win', v_spin.amount_php, trim(p_full_name), trim(p_mobile), nullif(trim(p_email), ''), coalesce(p_brand, 'food'))
  returning id into v_id;
  update public.spins set voucher_claim_id = v_id where id = v_spin.id;
  return v_id;
end;
$function$;

revoke all on function public.get_spin_state(text) from public, anon;
revoke all on function public.answer_spin_campaign(text, integer) from public, anon;
revoke all on function public.spin_wheel() from public, anon;
revoke all on function public.claim_spin_prize(uuid, text, text, text, text) from public, anon;
grant execute on function public.get_spin_state(text) to authenticated;
grant execute on function public.answer_spin_campaign(text, integer) to authenticated;
grant execute on function public.spin_wheel() to authenticated;
grant execute on function public.claim_spin_prize(uuid, text, text, text, text) to authenticated;

-- ── admin RPCs ───────────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_spin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized';
  end if;
  return jsonb_build_object(
    'config', app_private.spin_config(),
    'weekStart', app_private.spin_week_start(),
    'potLeft', app_private.spin_pot_left(),
    'week', (
      select jsonb_build_object(
        'spins', count(*),
        'people', count(distinct user_id),
        'grab100', count(*) filter (where prize = 'grab100'),
        'food50', count(*) filter (where prize = 'food50'),
        'locked50', count(*) filter (where prize = 'locked50'),
        'claimedPhp', coalesce(sum(amount_php) filter (where voucher_claim_id is not null), 0)
      )
      from public.spins where not is_test and created_at >= app_private.spin_week_start()
    ),
    'allTime', (
      select jsonb_build_object(
        'spins', count(*),
        'people', count(distinct user_id),
        'claimedPhp', coalesce(sum(amount_php) filter (where voucher_claim_id is not null), 0),
        'lockedOpen', count(*) filter (where prize = 'locked50' and voucher_claim_id is null and expires_at > now())
      )
      from public.spins where not is_test
    ),
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', c.code, 'title', c.title, 'body', c.body, 'videoUrl', c.video_url, 'question', c.question,
        'options', c.options, 'answerIndex', c.answer_index, 'startsAt', c.starts_at, 'endsAt', c.ends_at,
        'active', c.active, 'createdAt', c.created_at,
        'tickets', (select count(*) from public.spin_tickets t where t.campaign_code = c.code),
        'spins', (select count(*) from public.spins s where s.campaign_code = c.code and not s.is_test),
        'wins', (select count(*) from public.spins s where s.campaign_code = c.code and not s.is_test and s.prize in ('grab100', 'food50', 'locked50'))
      ) order by c.created_at desc)
      from public.spin_campaigns c
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(r order by r.created_at desc) from (
        select s.created_at, s.prize, s.amount_php as "amountPhp", s.segment, s.source, s.campaign_code as "campaignCode",
          s.is_test as "isTest", s.voucher_claim_id is not null as claimed, s.user_id as "userId",
          coalesce(u.display_name, u.username, u.facebook_name) as name
        from public.spins s left join public.users u on u.id = s.user_id
        order by s.created_at desc limit 40
      ) r
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.admin_set_spin_config(p_config jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_next jsonb;
  v_seg text;
  v_key text;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized';
  end if;
  v_next := app_private.spin_config() || coalesce(p_config, '{}'::jsonb);
  if (v_next ->> 'mode') not in ('off', 'team', 'on') then
    raise exception 'mode must be off, team or on';
  end if;
  foreach v_key in array array['grab100', 'food50', 'locked50'] loop
    if coalesce((v_next -> 'pot' ->> v_key)::numeric, -1) < 0 or (v_next -> 'pot' ->> v_key)::numeric > 1000 then
      raise exception 'pot % must be 0 to 1000', v_key;
    end if;
  end loop;
  foreach v_seg in array array['new', 'comeback', 'regular'] loop
    foreach v_key in array array['grab100', 'food50', 'locked50', 'extra', 'none'] loop
      if coalesce((v_next -> 'odds' -> v_seg ->> v_key)::numeric, -1) < 0 then
        raise exception 'odds %.% must be 0 or more', v_seg, v_key;
      end if;
    end loop;
  end loop;
  insert into public.telegram_bot_settings (key, value, description, updated_at)
  values ('spin_wheel', v_next::text, 'Moo-Spin wheel: mode off|team|on, weekly pot, odds per segment. Edit in Admin → Spin wheel.', now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return v_next;
end;
$function$;

create or replace function public.admin_save_spin_campaign(p_campaign jsonb)
returns text
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_code text := upper(btrim(coalesce(p_campaign ->> 'code', '')));
  v_question text := nullif(btrim(coalesce(p_campaign ->> 'question', '')), '');
  v_options jsonb := coalesce(p_campaign -> 'options', '[]'::jsonb);
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized';
  end if;
  if jsonb_typeof(v_options) <> 'array' then
    v_options := '[]'::jsonb;
  end if;
  insert into public.spin_campaigns (code, title, body, video_url, question, options, answer_index, starts_at, ends_at, active, created_by)
  values (
    v_code,
    btrim(coalesce(p_campaign ->> 'title', '')),
    nullif(btrim(coalesce(p_campaign ->> 'body', '')), ''),
    nullif(btrim(coalesce(p_campaign ->> 'videoUrl', '')), ''),
    v_question,
    case when v_question is null then '[]'::jsonb else v_options end,
    case when v_question is null then null else (p_campaign ->> 'answerIndex')::int end,
    coalesce((p_campaign ->> 'startsAt')::timestamptz, now()),
    (p_campaign ->> 'endsAt')::timestamptz,
    coalesce((p_campaign ->> 'active')::boolean, true),
    auth.uid()
  )
  on conflict (code) do update set
    title = excluded.title, body = excluded.body, video_url = excluded.video_url, question = excluded.question,
    options = excluded.options, answer_index = excluded.answer_index, starts_at = excluded.starts_at,
    ends_at = excluded.ends_at, active = excluded.active, updated_at = now();
  return v_code;
end;
$function$;

revoke all on function public.admin_spin_overview() from public, anon;
revoke all on function public.admin_set_spin_config(jsonb) from public, anon;
revoke all on function public.admin_save_spin_campaign(jsonb) from public, anon;
grant execute on function public.admin_spin_overview() to authenticated;
grant execute on function public.admin_set_spin_config(jsonb) to authenticated;
grant execute on function public.admin_save_spin_campaign(jsonb) to authenticated;
