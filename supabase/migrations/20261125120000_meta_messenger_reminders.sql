-- Messenger repay reminders sent by our own app straight through Meta (utility template
-- moodeng_repay_reminder), from Supabase every 30 minutes. No Mac, no SendPulse dashboard.
-- Proven 2026-11-25: Daecon (silent since 26 Sep) received it. See _shared/metaMessenger.ts.
--
-- Shares public.messenger_reminder_sends with the Mac relay: a row claimed here is 'sending', so the
-- relay can't take it too. Failed rows (3 tries) end up in the 11:00 team Telegram paste list.
-- Switch: telegram_bot_settings.meta_reminders_enabled = 'true'.

-- The borrower's Page-scoped id (PSID) from their latest message event in SendPulse. Null = never
-- seen in our event log (the caller then looks the name up in the Page's conversations).
create or replace function private.messenger_meta_psid(p_contact_id text)
returns text language sql stable security definer set search_path = ''
as $$
   select e.payload->'info'->'message'->'channel_data'->>'sender_id'
     from public.messenger_contact_events e
    where e.contact_id = p_contact_id
      and e.payload->'info'->'message'->'channel_data'->>'sender_id' ~ '^[0-9]{5,25}$'
      and e.payload->'info'->'message'->'channel_data'->>'sender_id' <> '1148756028310286'
    order by e.created_at desc
    limit 1;
$$;
revoke all on function private.messenger_meta_psid(text) from public, anon, authenticated;

create or replace function public.meta_reminder_claim()
returns table (id bigint, psid text, first_name text, facebook_name text, amount_text text, due_text text, kind text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
begin
   if coalesce((select value from public.telegram_bot_settings where key = 'meta_reminders_enabled'), '') <> 'true' then
      return;
   end if;
   if extract(hour from now() at time zone 'Asia/Manila') not between 8 and 20 then return; end if;

   insert into public.messenger_reminder_sends (loan_id, user_id, due_on, kind, contact_id, status, attempts, claimed_at)
   select c.loan_id, c.user_id, c.due_on, c.kind, c.contact_id, 'failed', 0, null
     from private.messenger_reminder_candidates() c
   on conflict (loan_id, due_on, kind) do nothing;

   return query
   with c as (select * from private.messenger_reminder_candidates())
   update public.messenger_reminder_sends s
      set status = 'sending', claimed_at = now(), attempts = s.attempts + 1, contact_id = c.contact_id
     from c
    where s.loan_id = c.loan_id and s.due_on = c.due_on and s.kind = c.kind
      and ((s.status = 'failed' and s.attempts < 3) or (s.status = 'sending' and s.claimed_at < now() - interval '15 minutes'))
   returning s.id, private.messenger_meta_psid(c.contact_id), c.first_name, c.facebook_name, c.amount_text, c.due_text, c.kind;
end;
$$;
revoke all on function public.meta_reminder_claim() from public, anon, authenticated;
grant execute on function public.meta_reminder_claim() to service_role;

create or replace function public.meta_reminder_report(p_id bigint, p_status text, p_detail text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
   if p_status not in ('sent', 'failed') then raise exception 'bad status'; end if;
   update public.messenger_reminder_sends
      set status = p_status,
          sent_at = case when p_status = 'sent' then now() else sent_at end,
          detail = left(coalesce(p_detail, detail), 500)
    where id = p_id and status = 'sending';
end;
$$;
revoke all on function public.meta_reminder_report(bigint, text, text) from public, anon, authenticated;
grant execute on function public.meta_reminder_report(bigint, text, text) to service_role;

-- Every 30 minutes: ask admin-messenger to send what's due (it claims through meta_reminder_claim).
create or replace function private.meta_reminders_tick()
returns void language plpgsql security definer set search_path = ''
as $$
begin
   if coalesce((select value from public.telegram_bot_settings where key = 'meta_reminders_enabled'), '') <> 'true' then
      return;
   end if;
   perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL') || '/functions/v1/admin-messenger',
      headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY'),
         'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY'),
         'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN')),
      body := jsonb_build_object('action', 'meta_reminders_run'),
      timeout_milliseconds := 60000);
end;
$$;
revoke all on function private.meta_reminders_tick() from public, anon, authenticated;

select cron.schedule('meta-messenger-reminders', '7,37 * * * *', $$select private.meta_reminders_tick()$$);
