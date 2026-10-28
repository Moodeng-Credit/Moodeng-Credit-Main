-- Discord #rewards mirrors the Telegram rewards group (voucher-claim-telegram-notification → toDiscord).
-- The webhook sits in the vault as DISCORD_REWARDS_WEBHOOK_URL (edge function secrets are at their cap).

-- Server only: the Discord #rewards webhook from the vault.
create or replace function public.discord_rewards_webhook()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'DISCORD_REWARDS_WEBHOOK_URL' limit 1;
$$;

revoke all on function public.discord_rewards_webhook() from public, anon, authenticated;
grant execute on function public.discord_rewards_webhook() to service_role;
