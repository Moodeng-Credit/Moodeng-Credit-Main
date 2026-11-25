-- Secrets for sending Messenger utility templates through our own Meta app (_shared/metaMessenger.ts).
-- Vault, because edge function secrets are at their cap. Only the service role can read them.
--   META_PAGE_MESSAGING_TOKEN  added by George (never typed into chat or the repo)
--   META_WEBHOOK_VERIFY_TOKEN  random, made here; pasted into the app's webhook settings
create or replace function public.read_meta_secret(secret_name text)
returns text
language sql stable security definer
set search_path to ''
as $$
   select decrypted_secret from vault.decrypted_secrets
   where name = secret_name
     and secret_name in ('META_PAGE_MESSAGING_TOKEN', 'META_WEBHOOK_VERIFY_TOKEN')
   limit 1;
$$;
revoke all on function public.read_meta_secret(text) from public, anon, authenticated;
grant execute on function public.read_meta_secret(text) to service_role;

do $$
begin
   if not exists (select 1 from vault.secrets where name = 'META_WEBHOOK_VERIFY_TOKEN') then
      perform vault.create_secret(replace(gen_random_uuid()::text, '-', ''), 'META_WEBHOOK_VERIFY_TOKEN', 'Meta webhook verify token for Moodeng Messaging (sendpulse-events?meta=1)');
   end if;
end $$;
