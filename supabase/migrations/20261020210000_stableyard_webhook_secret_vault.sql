-- Stableyard webhook signing secret lives in the DB vault, not edge-function secrets: the project is
-- at Supabase's 100-secret cap. The value itself is stored with vault.create_secret (never in a
-- migration). This reader is the only way out, and only the service role can call it.
create or replace function public.stableyard_webhook_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
   select decrypted_secret from vault.decrypted_secrets where name = 'STABLEYARD_WEBHOOK_SECRET' limit 1;
$$;

revoke all on function public.stableyard_webhook_secret() from public, anon, authenticated;
grant execute on function public.stableyard_webhook_secret() to service_role;
