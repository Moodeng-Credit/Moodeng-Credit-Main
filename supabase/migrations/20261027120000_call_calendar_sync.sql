-- Call calendars: Emma's Calendly hours are copied onto her Cal.com schedule every day, and George's
-- Google Calendar busy times hide clashing call slots. The keys live in the vault (the project is at
-- its edge-secret cap); read_call_secret hands back only these names, and only to the service role.
-- Vault values (CALENDLY_EMMA_TOKEN, GOOGLE_CALENDAR_KEY_GEORGE, GOOGLE_CALENDAR_ID_GEORGE) are set by hand.

create or replace function public.read_call_secret(secret_name text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
   select decrypted_secret from vault.decrypted_secrets
   where name = secret_name
     and secret_name in ('CALENDLY_EMMA_TOKEN', 'GOOGLE_CALENDAR_KEY_GEORGE', 'GOOGLE_CALENDAR_ID_GEORGE')
   limit 1;
$$;

revoke all on function public.read_call_secret(text) from public, anon, authenticated;
grant execute on function public.read_call_secret(text) to service_role;

-- 00:05 Bangkok every day.
select cron.unschedule('emma-calendly-hours-sync') where exists (select 1 from cron.job where jobname = 'emma-calendly-hours-sync');
select cron.schedule(
  'emma-calendly-hours-sync',
  '5 17 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/calcom-round-robin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1),
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := '{"action": "sync_calendly_hours"}'::jsonb
  )
  $cron$
);
