-- Giftaway eGifts as the first choice for reward vouchers (supabase/functions/_shared/giftaway.ts).
-- The keys sit in the vault as one JSON secret GIFTAWAY ({ api_key, private_key, email, dashboard });
-- edge function secrets are at their cap. Off until giftaway_enabled is 'true' (after a test order).

-- Server only: the Giftaway keys from the vault.
create or replace function public.giftaway_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'GIFTAWAY' limit 1;
$$;

revoke all on function public.giftaway_config() from public, anon, authenticated;
grant execute on function public.giftaway_config() to service_role;

insert into public.telegram_bot_settings (key, value, description)
values ('giftaway_enabled', 'false', 'true = send reward vouchers as Giftaway eGifts first (Jollibee Group / Grab), Xoxo links and Bitrefill as fallback.')
on conflict (key) do nothing;
