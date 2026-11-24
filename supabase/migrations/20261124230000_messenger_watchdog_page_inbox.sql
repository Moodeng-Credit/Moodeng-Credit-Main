-- The 11:00 Bangkok "send by hand" list for Messenger-only borrowers now works without the Mac relay:
-- each person gets a ready-to-paste message (amount as "20 USDC", no "$") and the team sends it from the
-- Page inbox. Typed Page-inbox messages reach people even weeks after their last message (Daecon,
-- 2026-11-24), while SendPulse template campaigns were all rejected by Meta for the "$" in "$20".
-- Same schedule (pg_cron messenger-reminder-watchdog, 04:00 UTC) and same switch (messenger_relay_enabled).
create or replace function private.messenger_reminder_watchdog()
returns void language plpgsql security definer set search_path = ''
as $$
declare v_text text; v_n int;
begin
   if coalesce((select value from public.telegram_bot_settings where key = 'messenger_relay_enabled'), '') <> 'true' then
      return;
   end if;
   insert into public.messenger_reminder_sends (loan_id, user_id, due_on, kind, contact_id, status, attempts)
   select c.loan_id, c.user_id, c.due_on, c.kind, c.contact_id, 'failed', 0
     from private.messenger_reminder_candidates() c
   on conflict (loan_id, due_on, kind) do nothing;

   with c as (select * from private.messenger_reminder_candidates()),
   handed as (
      update public.messenger_reminder_sends s set status = 'manual'
        from c
       where s.loan_id = c.loan_id and s.due_on = c.due_on and s.kind = c.kind
         and (s.status = 'failed' or (s.status = 'sending' and s.claimed_at < now() - interval '15 minutes'))
      returning c.*, s.detail
   ),
   msg as (
      select h.*,
             regexp_replace(h.amount_text, '\$\s*([0-9][0-9.,]*)', '\1 USDC', 'g') as amount_usdc
        from handed h
   )
   select count(*), string_agg(
            '• ' || m.first_name || coalesce(' (👤 ' || m.facebook_name || ')', '') || ' @' || coalesce(m.username, '?')
            || case m.kind when 'due_2d' then ', due in 2 days' when 'due_today' then ', due TODAY' else ', OVERDUE' end
            || E'\n' || '"Hi ' || m.first_name || ', this is Moodeng Credit. Your loan payment of ' || m.amount_usdc
            || case m.kind
                 when 'due_2d' then ' is due on ' || m.due_text || '.'
                 when 'due_today' then ' is due today (' || m.due_text || ').'
                 else ' was due on ' || m.due_text || ' and is now late. Please pay today to keep your credit level.'
               end
            || ' Pay here: https://moodeng.app/repay"',
            E'\n\n')
     into v_n, v_text
     from msg m;
   if coalesce(v_n, 0) = 0 then return; end if;
   perform private.viber_team_post(
      '📨 Messenger repay reminders to send by hand (' || v_n || ')' || E'\n'
      || 'Open the Page inbox, search each name, paste their message:' || E'\n'
      || 'https://business.facebook.com/latest/inbox/messenger?asset_id=1148756028310286&business_id=1338534870504694'
      || E'\n\n' || v_text);
end;
$$;
revoke all on function private.messenger_reminder_watchdog() from public, anon, authenticated;
