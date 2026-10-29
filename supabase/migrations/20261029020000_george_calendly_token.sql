-- "Either is free" call booking (George, 2026-10-29): George's Calendly hours are copied onto his
-- Cal.com schedule every night, like Emma's. His token (CALENDLY_GEORGE_TOKEN, set by hand in the
-- vault) joins the names read_call_secret hands back to the service role.

create or replace function public.read_call_secret(secret_name text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
   select decrypted_secret from vault.decrypted_secrets
   where name = secret_name
     and secret_name in ('CALENDLY_EMMA_TOKEN', 'CALENDLY_GEORGE_TOKEN', 'GOOGLE_CALENDAR_KEY_GEORGE', 'GOOGLE_CALENDAR_ID_GEORGE')
   limit 1;
$$;

revoke all on function public.read_call_secret(text) from public, anon, authenticated;
grant execute on function public.read_call_secret(text) to service_role;
