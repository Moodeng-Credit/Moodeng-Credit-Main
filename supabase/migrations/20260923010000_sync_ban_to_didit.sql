-- Mirror bans onto Didit: when a user's account_status moves into 'banned', mark their Didit
-- profile BLOCKED (Didit then auto-declines any new KYC session they start); when it moves out
-- of 'banned', set it back to ACTIVE.
--
-- Hanging this on public.users.account_status catches every ban path in one place: the admin
-- panel (admin_set_account_status, and admin_account_restrictions via its sync trigger),
-- admin-refund-loan, and bans applied by hand in SQL.
--
-- The call is fire-and-forget via pg_net, so a Didit outage can never block or roll back a ban.
-- The edge function reads the user's current status itself — the trigger only names the user, so the
-- function runs with verify_jwt = false and needs no service key (see config.toml).

create or replace function private.sync_didit_user_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.account_status = 'banned') is distinct from (new.account_status = 'banned') then
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1)
        || '/functions/v1/didit-sync-user-status',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
      ),
      body := jsonb_build_object('user_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists sync_didit_user_status on public.users;
create trigger sync_didit_user_status
after update of account_status on public.users
for each row
execute function private.sync_didit_user_status();
