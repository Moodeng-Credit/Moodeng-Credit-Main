-- Sign in with the Telegram APP (not Telegram's website login), so it works inside Facebook's /
-- TikTok's in-app browser where oauth.telegram.org gets lost between apps.
--
--   1. The page asks telegram-login {action:'app_start'} → a one-time code + a poll secret only that
--      page knows. The page opens our bot: t.me/<bot>?start=login_<code>.
--   2. The person taps Start in Telegram. telegram-webhook does NOT sign in on Start alone (anyone can
--      be sent someone else's link): it shows which device asked and when, and asks them to tap the
--      2-digit number shown on their Moodeng page out of three. Only the right number, tapped by the
--      same Telegram account that pressed Start, claims the code. A wrong number or "Not me" kills it.
--   3. The page (still open in Facebook's browser) polls telegram-login {action:'app_poll', code,
--      pollSecret}; once claimed it gets a session for that Telegram account — the same account
--      matching as the website login. Starting the bot also means the bot can message them.
--
-- Codes live 10 minutes, are claimed once and consumed once. Only hashes are stored. Service role only.
-- (Bot buttons don't use codes: they're Telegram login_url buttons, signed for whoever taps them.)

create table if not exists public.telegram_app_logins (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,          -- sha256 hex of the code in the /start link
  poll_secret_hash text not null,          -- sha256 hex of the secret only the requesting page holds
  intent text check (intent in ('id')),    -- 'id' when it came from /id (Indonesia track)
  match_number smallint not null,          -- shown on the page; must be tapped in Telegram
  device_label text,                       -- "Android · Facebook" — shown in the Telegram prompt
  location_label text,                     -- country from the edge network (not settable by the browser)
  match_choices smallint[],                -- the 4 buttons, fixed at the first prompt (re-pressing Start
                                           -- must not reveal the real number by changing the decoys)
  pending_telegram_id bigint,              -- who pressed Start (only they can answer the prompt)
  prompted_at timestamptz,
  ip_hash text,                            -- for a simple per-IP rate limit on app_start
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  telegram_id bigint,                      -- set when the bot sees /start login_<code>
  telegram_username text,
  first_name text,
  last_name text,
  claimed_at timestamptz,
  consumed_at timestamptz                  -- set when the page exchanged it for a session
);

create index if not exists telegram_app_logins_created_idx on public.telegram_app_logins (created_at);
create index if not exists telegram_app_logins_ip_idx on public.telegram_app_logins (ip_hash, created_at);

alter table public.telegram_app_logins enable row level security;
-- No policies: only the service role (edge functions) reads or writes it.
revoke all on public.telegram_app_logins from anon, authenticated;

-- "Continue in Telegram" (loan-access id_step continueInTelegram): at most one bot message a minute.
alter table public.users add column if not exists id_continue_sent_at timestamptz;

-- Telegram's signed login data (website redirect / bot login_url buttons) may sign in only once.
create table if not exists public.telegram_login_hashes (
  hash_sha256 text primary key,
  used_at timestamptz not null default now()
);
alter table public.telegram_login_hashes enable row level security;
revoke all on public.telegram_login_hashes from anon, authenticated;
