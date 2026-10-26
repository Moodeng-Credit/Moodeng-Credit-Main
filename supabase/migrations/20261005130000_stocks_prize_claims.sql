-- Prize-wheel claims from moodeng.app/stocks. The page lets a visitor type their TikTok @handle and
-- claim what the wheel gave them (pandesal points / golden tickets). The public stocks-claim edge
-- function validates the numbers against what the wheel can produce and stores one row per handle
-- here, so no claim is lost even if the Discord webhook is not configured. Nothing on the page can
-- read this table: RLS is on with no policies, so only the service role (the edge function, admin
-- SQL) can touch it. The wheel runs in the browser, so every row is a CLAIM to verify, never proof.
create table if not exists public.stocks_prize_claims (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  tiktok_handle text not null check (tiktok_handle ~ '^[A-Za-z0-9._]{2,24}$'),
  spins         smallint not null check (spins between 1 and 4),
  points        integer  not null check (points >= 0 and points % 5 = 0),
  tickets       smallint not null check (tickets between 0 and 4 and tickets <= spins),
  lang          text not null default 'fil' check (lang in ('fil', 'en')),
  status        text not null default 'new' check (status in ('new', 'contacted', 'won', 'paid', 'rejected')),
  notes         text
);

-- One claim per handle, case-insensitive (TikTok handles are not case sensitive).
create unique index if not exists stocks_prize_claims_handle_key
  on public.stocks_prize_claims (lower(tiktok_handle));

alter table public.stocks_prize_claims enable row level security;
revoke all on table public.stocks_prize_claims from anon, authenticated;

comment on table public.stocks_prize_claims is
  'Claims from the moodeng.app/stocks prize wheel. Client-decided results: verify before paying anything.';
