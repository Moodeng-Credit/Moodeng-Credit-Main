-- Run the KYC cross-check the moment a Didit result lands, not just in the daily 01:00 UTC sweep.
--
-- didit-webhook writes every outcome onto public.users: is_didit → 'ACTIVE' on approval, and
-- didit_id_status (+ didit_decline_reason) for declined / in-review / duplicate results. A finished
-- result on either column pings kyc-cross-check, which pulls the new session from Didit, compares it
-- against everyone and posts only findings nobody has reported yet (overlapping runs each claim their
-- own rows, so nothing posts twice). In-progress / not-started updates are ignored.
--
-- Fire-and-forget via pg_net, same caller pattern as sync_didit_user_status, so a slow Didit API can
-- never hold up the webhook's write.

create or replace function private.kyc_cross_check_on_didit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.is_didit = 'ACTIVE' and old.is_didit is distinct from 'ACTIVE')
     or (new.didit_id_status is distinct from old.didit_id_status
         and lower(coalesce(new.didit_id_status, '')) in ('approved', 'declined', 'in review', 'duplicate'))
  then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1)
        || '/functions/v1/kyc-cross-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists kyc_cross_check_on_didit_change on public.users;
create trigger kyc_cross_check_on_didit_change
after update of is_didit, didit_id_status on public.users
for each row
execute function private.kyc_cross_check_on_didit_change();
