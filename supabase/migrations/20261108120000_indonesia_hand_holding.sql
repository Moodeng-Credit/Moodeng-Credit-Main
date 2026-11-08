-- Indonesia track: hand-holding (docs/INDONESIA_TRACK.md "Hand-holding").
--
--   1. Loans go out by Walt Transfer: George's Walt → the borrower's Telegram @username (free, no chain).
--      The 5-minute job posts one "send X USDT to @user" card per open request (_shared/idWaltPayouts.ts);
--      "✅ Sent" records the funding (found_by 'walt', hash 'walt-transfer-out:<loan id>').
--      Setting id_payout_mode: 'walt_transfer' (default) | 'chain' (the payout wallet / Binance TH way).
--   2. First loan is small: until a borrower has repaid a loan on time, they can only take up to
--      id_first_loan_max ($5). Empty setting = off. Enforced on every insert (trigger) and shown by
--      get_id_loan_rules() (the app) / id_loan_amounts_for() (the bot).
--   3. The AI helper's questions and answers (id_ai_questions): rate limit + what people ask.
--   4. id_repay_requests.nudged_at: one "need a hand paying?" message per request.

insert into public.telegram_bot_settings (key, value, description) values
  ('id_payout_mode', 'walt_transfer', 'Indonesia track: how loans go out. walt_transfer = card to the admin chat, George sends by Walt Transfer to the borrower''s @username and taps ✅ Sent (free). chain = payout wallet / Binance TH on BNB Chain.'),
  ('id_first_loan_max', '5', 'Indonesia track: largest loan (USD) before the borrower has repaid one loan on time. Empty = no first-loan cap.'),
  ('id_ai_helper', 'on', 'Indonesia track: the AI helper answers typed questions in the bot (on|off). Off = the old "send /start support" reply.'),
  ('id_ai_daily_limit', '20', 'Indonesia track: AI helper answers per borrower per day; after that questions go to the team.')
on conflict (key) do nothing;

-- ── 1. Walt Transfer payouts ─────────────────────────────────────────────────────────────────────
alter table public.id_manual_payouts add column if not exists walt_card_at timestamptz;
alter table public.id_manual_payouts add column if not exists walt_username text;
alter table public.id_manual_payouts add column if not exists walt_username_asked_at timestamptz;
comment on column public.id_manual_payouts.walt_card_at is 'Walt Transfer mode: when the "send X USDT to @user" card was posted to the admin chat (one per loan).';
comment on column public.id_manual_payouts.walt_username is 'The Telegram @username the card told the team to send to.';

alter table public.id_manual_payouts drop constraint if exists id_manual_payouts_found_by_check;
alter table public.id_manual_payouts add constraint id_manual_payouts_found_by_check
  check (found_by in ('scan', 'txid', 'auto', 'walt'));

-- ── 2. First loan is small ───────────────────────────────────────────────────────────────────────
-- The cap for this borrower, or null (no cap: setting empty, or they repaid a loan on time).
create or replace function app_private.id_first_loan_cap(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_user_id is null then null
    when coalesce(trim((select value from public.telegram_bot_settings where key = 'id_first_loan_max')), '') !~ '^[0-9]+(\.[0-9]{1,2})?$' then null
    when exists (
      select 1 from public.loans l
       where l.borrower_user_id = p_user_id and app_private.is_loan_repaid_on_time(l)
    ) then null
    else trim((select value from public.telegram_bot_settings where key = 'id_first_loan_max'))::numeric
  end;
$$;
revoke all on function app_private.id_first_loan_cap(uuid) from public, anon, authenticated;

-- The rules the app shows (my_id_onboarding → rules): amounts above this borrower's cap are left out.
-- Called without a signed-in user (service role, enforce_new_loan_terms under the bot) it's the full list.
create or replace function public.get_id_loan_rules()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with cfg as (
    select coalesce((
      select jsonb_agg(a::numeric order by a::numeric)
      from unnest(string_to_array(coalesce((select value from public.telegram_bot_settings where key = 'id_loan_amounts'), '5,10'), ',')) a
      where trim(a) ~ '^[0-9]+(\.[0-9]{1,2})?$'
    ), '[5,10]'::jsonb) as amounts,
    app_private.id_first_loan_cap(auth.uid()) as cap
  )
  select jsonb_build_object(
    'amounts', case
      when cap is null then amounts
      else coalesce((select jsonb_agg(x order by x::numeric) from jsonb_array_elements(amounts) x where x::numeric <= cap), jsonb_build_array(cap))
    end,
    'maxTermDays', coalesce(nullif((select value from public.telegram_bot_settings where key = 'id_max_term_days'), '')::int, 14),
    'firstLoanMax', cap
  )
  from cfg;
$$;
revoke execute on function public.get_id_loan_rules() from public;
grant execute on function public.get_id_loan_rules() to anon, authenticated, service_role;

-- The same for a given borrower (the bot runs as the service role).
create or replace function public.id_loan_amounts_for(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with cfg as (
    select coalesce((
      select jsonb_agg(a::numeric order by a::numeric)
      from unnest(string_to_array(coalesce((select value from public.telegram_bot_settings where key = 'id_loan_amounts'), '5,10'), ',')) a
      where trim(a) ~ '^[0-9]+(\.[0-9]{1,2})?$'
    ), '[5,10]'::jsonb) as amounts,
    app_private.id_first_loan_cap(p_user_id) as cap
  )
  select jsonb_build_object(
    'amounts', case
      when cap is null then amounts
      else coalesce((select jsonb_agg(x order by x::numeric) from jsonb_array_elements(amounts) x where x::numeric <= cap), jsonb_build_array(cap))
    end,
    'allAmounts', amounts,
    'maxTermDays', coalesce(nullif((select value from public.telegram_bot_settings where key = 'id_max_term_days'), '')::int, 14),
    'firstLoanMax', cap
  )
  from cfg;
$$;
revoke all on function public.id_loan_amounts_for(uuid) from public, anon, authenticated;
grant execute on function public.id_loan_amounts_for(uuid) to service_role;

-- Every insert (app, bot, admin): an Indonesia-track borrower's loan over their cap is refused.
create or replace function app_private.enforce_id_first_loan_small()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap numeric;
begin
  if not exists (select 1 from public.users u where u.id = new.borrower_user_id and u.market = 'ID') then
    return new;
  end if;
  v_cap := app_private.id_first_loan_cap(new.borrower_user_id);
  if v_cap is not null and new.loan_amount > v_cap then
    raise exception 'loans: first_loan_small: your first loan can be at most $% — repay a loan on time to unlock more', v_cap
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_id_first_loan_small on public.loans;
create trigger trg_enforce_id_first_loan_small
  before insert on public.loans
  for each row execute function app_private.enforce_id_first_loan_small();

-- ── 3. AI helper log ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.id_ai_questions (
  id bigserial primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  question text not null,
  answer text,
  guide text,
  handoff boolean not null default false,
  ms integer,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists id_ai_questions_user_day_idx on public.id_ai_questions (user_id, created_at desc);
alter table public.id_ai_questions enable row level security;
revoke all on public.id_ai_questions from public, anon, authenticated;
grant all on public.id_ai_questions to service_role;
grant usage, select on sequence public.id_ai_questions_id_seq to service_role;
drop policy if exists id_ai_questions_admin_read on public.id_ai_questions;
create policy id_ai_questions_admin_read on public.id_ai_questions for select to authenticated
  using (app_private.is_moodeng_admin());
grant select on public.id_ai_questions to authenticated;

-- ── 4. "Need a hand paying?" ─────────────────────────────────────────────────────────────────────
alter table public.id_repay_requests add column if not exists nudged_at timestamptz;
