-- One-time "tell us when they repay" alerts.
--
-- telegram_bot_settings.repay_watch holds a JSON object of borrower user id → team note, e.g.
--   {"<user uuid>": "Heads up: she will ask for another loan right away."}
-- When one of that borrower's loans turns Paid, the team Telegram group gets
--   🚨 <name> (@username) repaid $X.
--   <note>
--   👤 Facebook: <name> — <link>
-- and the entry is removed, so it fires once. Add or remove people with plain SQL on the setting.
--
-- SECURITY DEFINER + exception guard: a repay must never fail because of this alert
-- (borrower-side updates run as `authenticated`, see the #1799 outage).

create or replace function public.notify_repay_watch()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
   v_watch jsonb;
   v_note text;
   v_chat text;
   v_token text;
   v_user record;
   v_link text;
   v_text text;
begin
   begin
      select nullif(trim(value), '')::jsonb into v_watch
      from public.telegram_bot_settings where key = 'repay_watch';
      if v_watch is null or jsonb_typeof(v_watch) <> 'object' or not (v_watch ? new.borrower_user_id::text) then
         return new;
      end if;
      v_note := v_watch ->> new.borrower_user_id::text;

      -- One-shot: drop the entry first so a second Paid update can't post twice.
      update public.telegram_bot_settings
         set value = (v_watch - new.borrower_user_id::text)::text
       where key = 'repay_watch';

      select value into v_chat from public.telegram_bot_settings where key = 'team_group_chat_id';
      v_token := public.get_telegram_api_token();
      if coalesce(v_chat, '') = '' or coalesce(v_token, '') = '' then
         return new;
      end if;

      select u.display_name, u.username, u.facebook_name, u.facebook_profile_url, u.messenger_psid
        into v_user
        from public.users u where u.id = new.borrower_user_id;

      v_link := coalesce(
         nullif(trim(v_user.facebook_profile_url), ''),
         case when nullif(trim(v_user.messenger_psid), '') is not null
              then 'https://login.sendpulse.com/chatbots/chats?contact_id=' || trim(v_user.messenger_psid) || '&channel=messenger'
         end);

      v_text := '🚨 ' || coalesce(nullif(v_user.display_name, ''), nullif(v_user.facebook_name, ''), 'Borrower')
         || coalesce(' (@' || nullif(v_user.username, '') || ')', '')
         || ' repaid $' || trim(to_char(coalesce(new.repaid_amount, new.total_repayment_amount, 0), 'FM999990.00')) || '.'
         || coalesce(E'\n' || nullif(trim(v_note), ''), '')
         || case when v_link is not null
                 then E'\n👤 Facebook: ' || coalesce(nullif(v_user.facebook_name, ''), 'profile') || ' — ' || v_link
                 else '' end;

      perform net.http_post(
         url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
         headers := jsonb_build_object('Content-Type', 'application/json'),
         body := jsonb_build_object('chat_id', v_chat, 'text', v_text, 'disable_web_page_preview', true),
         timeout_milliseconds := 10000
      );
   exception when others then
      raise warning 'notify_repay_watch failed for loan %: %', new.id, sqlerrm;
   end;
   return new;
end;
$$;

revoke all on function public.notify_repay_watch() from public, anon, authenticated;

drop trigger if exists zz_notify_repay_watch on public.loans;
create trigger zz_notify_repay_watch
   after update of repayment_status on public.loans
   for each row
   when (new.repayment_status = 'Paid' and old.repayment_status is distinct from 'Paid')
   execute function public.notify_repay_watch();
