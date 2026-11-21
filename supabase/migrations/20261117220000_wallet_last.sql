-- Wallet last (George, 2026-11-17): a borrower's Instant Wallet (Openfort) is made as the very last
-- step of their loan request — after the ID check, right before "your request is live" — not at
-- sign-up. Fewer people open Openfort wallets (monthly cap), only those who really send a request.
-- Switch: telegram_bot_settings.wallet_last = on | off. Off = wallet first, as before.
-- Indonesia track keeps its own Walt step either way. Lenders are not affected.
insert into public.telegram_bot_settings (key, value, description)
values ('wallet_last', 'off', 'Borrower Instant Wallet made as the last step of the loan request: on | off')
on conflict (key) do nothing;

create or replace function public.get_wallet_last()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select lower(btrim(value)) = 'on' from public.telegram_bot_settings where key = 'wallet_last'), false);
$$;

revoke all on function public.get_wallet_last() from public;
grant execute on function public.get_wallet_last() to anon, authenticated;
