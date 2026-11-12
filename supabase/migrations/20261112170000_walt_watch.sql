-- Indonesia track: read Moodeng's Walt history (read-only, _shared/waltWatch.ts) so Walt Transfers confirm
-- themselves: an outgoing transfer to a borrower = the loan paid out (instead of "✅ Sent"), an incoming one
-- matching a 💰 Bayar request = the repayment recorded (instead of "✅ Arrived"). Sending stays by hand.
--
-- The Walt login (jwt + rotating refresh token, NOT a Telegram session) lives in the vault secret
-- WALT_SESSION, read and rotated only through the two functions below (service role only).

create or replace function public.walt_session_get()
returns text
language sql
stable
security definer
set search_path = ''
as $$
   select decrypted_secret from vault.decrypted_secrets where name = 'WALT_SESSION' limit 1;
$$;

create or replace function public.walt_session_set(p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
   v_id uuid;
begin
   select id into v_id from vault.secrets where name = 'WALT_SESSION' limit 1;
   if v_id is null then
      perform vault.create_secret(p_value, 'WALT_SESSION', 'Walt web-app login for the read-only Walt watch (_shared/waltWatch.ts)');
   else
      perform vault.update_secret(v_id, p_value);
   end if;
end;
$$;

revoke all on function public.walt_session_get() from public, anon, authenticated;
revoke all on function public.walt_session_set(text) from public, anon, authenticated;
grant execute on function public.walt_session_get() to service_role;
grant execute on function public.walt_session_set(text) to service_role;

-- Every Walt history row we've looked at, once (id = Walt's transaction id).
create table if not exists public.walt_transactions (
  id bigint primary key,
  type text not null,                 -- 'deposit' = money in; anything else = money out
  gateway text not null,              -- 'tg_transfer' = a Walt Transfer
  status text not null,
  currency text not null,
  amount text not null,
  tg_id bigint,                       -- the other side's Telegram id
  username text,                      -- the other side's @username (no @)
  created_at timestamptz not null,
  outcome text,                       -- what the watch did: payout_recorded, repay_recorded, would_*, unmatched, ignored…
  loan_id uuid,
  request_id bigint,
  note text,
  seen_at timestamptz not null default now()
);
alter table public.walt_transactions enable row level security;
revoke all on public.walt_transactions from public, anon, authenticated;

insert into public.telegram_bot_settings (key, value, description) values
  ('walt_watch', 'observe', 'Walt history watch: off | observe (only posts what it WOULD confirm) | on (confirms payouts and repayments by itself). /waltwatch in an admin chat.'),
  ('walt_pot_usdt', '', 'Last USDT balance read from Moodeng''s Walt (set by the watch).'),
  ('walt_pot_low_usd', '40', 'Walt pot alert: tell the team when the USDT balance drops below this.'),
  ('walt_pot_low_alerted_at', '', 'Last "Walt pot low" alert (at most every 12 h).'),
  ('walt_watch_alerted_at', '', 'Last "Walt watch can''t log in" alert (at most every 6 h).')
on conflict (key) do nothing;
