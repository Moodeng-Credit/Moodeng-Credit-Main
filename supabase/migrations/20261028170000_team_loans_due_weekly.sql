-- Weekly team list of unpaid loans due this week (+ still overdue) to the "loans due" Telegram chat.
-- loan-weekly-digest { event: 'team_due' } builds and sends it, once per week (loans_due_last_week).
insert into public.telegram_bot_settings (key, value, description)
values ('loans_due_chat_id', '-5522668930', 'Telegram chat for the weekly loans-due list (loan-weekly-digest team_due, Mondays 09:00 Bangkok)')
on conflict (key) do update set value = excluded.value, description = excluded.description, updated_at = now();

-- Mondays 09:00 Bangkok = 02:00 UTC.
do $$
begin
  perform cron.unschedule('team-loans-due-weekly');
exception
  when others then null;
end $$;

select cron.schedule(
  'team-loans-due-weekly',
  '0 2 * * 1',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/loan-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1)
    ),
    body := jsonb_build_object('event', 'team_due'),
    timeout_milliseconds := 60000
  )
  $$
);
