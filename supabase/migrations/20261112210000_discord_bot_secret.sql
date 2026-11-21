-- The Moodeng Discord app's bot, for posts that need working buttons (proof-of-income
-- Approve / Reject — see supabase/functions/_shared/incomeDocCards.ts). Webhook posts can't carry
-- them. Edge function secrets are at their cap, so it lives in the vault as one JSON secret:
--
--   select vault.create_secret('{"token":"<bot token>","channel_id":"<channel id>"}', 'DISCORD_BOT');
--
-- Until it's there, those posts fall back to the webhook with a link. Service role only.
create or replace function public.discord_bot_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'DISCORD_BOT' limit 1;
$$;

revoke all on function public.discord_bot_secret() from public, anon, authenticated;
grant execute on function public.discord_bot_secret() to service_role;
