-- Prize-wheel claims can now come from a logged-in Moodeng account (TikTok / LINE / any sign-in), which is a
-- VERIFIED claim, instead of only a typed TikTok @handle (unverified). One claim per account.
alter table public.stocks_prize_claims
  alter column tiktok_handle drop not null,
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists provider text check (provider is null or char_length(provider) <= 20),
  add column if not exists display_name text check (display_name is null or char_length(display_name) <= 100);

alter table public.stocks_prize_claims
  drop constraint if exists stocks_prize_claims_who;
alter table public.stocks_prize_claims
  add constraint stocks_prize_claims_who check (tiktok_handle is not null or user_id is not null);

create unique index if not exists stocks_prize_claims_user_key
  on public.stocks_prize_claims (user_id) where user_id is not null;

comment on column public.stocks_prize_claims.user_id is
  'Set when the claim came from a logged-in account (verified). Null for a typed, unverified TikTok handle.';
