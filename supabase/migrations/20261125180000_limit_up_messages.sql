-- "Your credit limit went up" on Messenger + WhatsApp, whenever users.cs goes up for an approved
-- borrower: repayment level-up (confirm-loan-payment), the admin ±1 level button, or a hand edit.
-- The trigger only queues a pg_net call; admin-messenger { action: 'limit_up' } does the sending
-- (Messenger free text inside 24h, WhatsApp template moodeng_follow_up) and posts the result to Discord.
-- Sign-up referral boosts don't message anyone: they land before the person is approved.
-- Switch: telegram_bot_settings.limit_up_messages_enabled ('true' = on).

insert into public.telegram_bot_settings (key, value)
values ('limit_up_messages_enabled', 'true')
on conflict (key) do nothing;

create or replace function private.notify_limit_up()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
   perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL') || '/functions/v1/admin-messenger',
      headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY'),
         'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY'),
         'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN')),
      body := jsonb_build_object(
         'action', 'limit_up',
         'userId', new.id,
         'from', greatest(coalesce(old.cs, 15), 15),
         'to', new.cs),
      timeout_milliseconds := 30000);
   return new;
exception when others then
   -- Never block the limit change itself because a message couldn't be queued.
   raise warning 'notify_limit_up failed: %', sqlerrm;
   return new;
end;
$$;

revoke all on function private.notify_limit_up() from public, anon, authenticated;

drop trigger if exists zz_notify_limit_up on public.users;
create trigger zz_notify_limit_up
   after update of cs on public.users
   for each row
   when (new.cs > greatest(coalesce(old.cs, 15), 15) and new.loan_access_status = 'approved')
   execute function private.notify_limit_up();
