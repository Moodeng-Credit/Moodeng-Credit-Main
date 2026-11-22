-- Messenger repay reminders for borrowers we can only reach on Messenger (no WhatsApp, push, Telegram
-- or Viber). Facebook only lets the Page write to them after 24h with an approved utility template
-- (moodeng_repay_reminder), and SendPulse sends those only from its dashboard, not its public API
-- (tested 2026-11-22, #1705/#1706). So a relay on George's Mac (scripts/messenger-relay/relay.mjs)
-- sends them through the dashboard's own API with his logged-in SendPulse session.
--
-- Safety: one contact per campaign, filtered by SendPulse contact id, and the relay sends only after
-- SendPulse counts exactly 1 recipient for that filter. Each (loan, due date, kind) is sent once.
-- 11:00 Bangkok: anything due today and not sent goes to team Telegram to send by hand.

create table if not exists public.messenger_reminder_sends (
   id bigserial primary key,
   loan_id uuid not null references public.loans (id) on delete cascade,
   user_id uuid not null,
   due_on date not null,
   kind text not null check (kind in ('due_2d', 'due_today', 'overdue_1')),
   contact_id text not null,
   status text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'manual')),
   attempts int not null default 0,
   detail text,
   claimed_at timestamptz,
   sent_at timestamptz,
   created_at timestamptz not null default now(),
   unique (loan_id, due_on, kind)
);
alter table public.messenger_reminder_sends enable row level security;
revoke all on public.messenger_reminder_sends from anon, authenticated;

-- Who should get a Messenger template reminder today. Open loans; two-payment loans use the next
-- unpaid part. Dates in the borrower's due timezone (default Manila). Pure read.
create or replace function private.messenger_reminder_candidates()
returns table (
   loan_id uuid, user_id uuid, due_on date, kind text, contact_id text,
   first_name text, facebook_name text, username text, amount_text text, due_text text
)
language sql stable security definer set search_path = ''
as $$
   with open_loans as (
      select l.id, l.borrower_user_id, coalesce(nullif(l.due_timezone, ''), 'Asia/Manila') tz,
             coalesce(l.repaid_amount, 0) repaid, l.total_repayment_amount total, l.due_date, l.repayment_schedule
        from public.loans l
       where l.loan_status = 'Lent' and l.repayment_status in ('Unpaid', 'Partial')
         and l.total_repayment_amount > coalesce(l.repaid_amount, 0)
   ),
   due as (
      -- single-payment loans
      select o.id, o.borrower_user_id, o.tz, (o.due_date at time zone o.tz)::date due_on, o.total - o.repaid owed
        from open_loans o
       where o.repayment_schedule is null or jsonb_typeof(o.repayment_schedule) <> 'array' or jsonb_array_length(o.repayment_schedule) = 0
      union all
      -- two-payment loans: the first part not yet covered by what they repaid
      (select distinct on (o.id) o.id, o.borrower_user_id, o.tz, (p.part ->> 'due')::date, p.cum - o.repaid
        from open_loans o
        cross join lateral (
           select s.part, sum((s.part ->> 'amount')::numeric) over (order by s.n) cum
             from jsonb_array_elements(o.repayment_schedule) with ordinality s (part, n)
        ) p
       where jsonb_typeof(o.repayment_schedule) = 'array' and p.cum > o.repaid
       order by o.id, (p.part ->> 'due')::date)
   ),
   kinds as (
      select d.*, case ((d.due_on - (now() at time zone d.tz)::date))
                     when 2 then 'due_2d' when 0 then 'due_today' when -1 then 'overdue_1' end kind
        from due d
   )
   select k.id, u.id, k.due_on, k.kind, u.messenger_psid,
          split_part(trim(coalesce(nullif(trim(u.display_name), ''), nullif(trim(u.facebook_name), ''), u.username, 'there')), ' ', 1),
          u.facebook_name, u.username,
          '$' || rtrim(rtrim(round(k.owed, 2)::text, '0'), '.'),
          to_char(k.due_on, 'Dy FMDD Mon')
     from kinds k
     join public.users u on u.id = k.borrower_user_id
    where k.kind is not null
      and u.messenger_psid is not null and u.messenger_verified_at is not null
      -- Messenger-only: every other reminder channel is missing or off.
      and not (u.whatsapp_contact_id is not null and u.notif_whatsapp is not false)
      and u.chat_id is null
      and not (u.viber_number is not null and u.notif_viber is not false)
      and (u.notif_push is false or not exists (
             select 1 from public.push_subscriptions s
              where s.user_id = u.id and s.failure_count < 3
                and (s.last_success_at is not null or s.created_at > now() - interval '30 days')));
$$;
revoke all on function private.messenger_reminder_candidates() from public, anon, authenticated;

-- The relay's token: only its sha256 lives here (telegram_bot_settings.messenger_relay_token_sha256).
create or replace function private.messenger_relay_token_ok(p_token text)
returns boolean language sql stable security definer set search_path = ''
as $$
   select coalesce(length(p_token) >= 32 and encode(extensions.digest(p_token, 'sha256'), 'hex') =
      (select value from public.telegram_bot_settings where key = 'messenger_relay_token_sha256'), false);
$$;
revoke all on function private.messenger_relay_token_ok(text) from public, anon, authenticated;

-- Relay: claim today's reminders (new, failed < 3 tries, or stuck 'sending' > 15 min). 08:00–21:00
-- borrower time only. Switch: telegram_bot_settings.messenger_relay_enabled = 'true'.
create or replace function public.messenger_relay_claim(p_token text)
returns table (id bigint, contact_id text, first_name text, amount_text text, due_text text, kind text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
begin
   if not private.messenger_relay_token_ok(p_token) then raise exception 'forbidden'; end if;
   insert into public.telegram_bot_settings (key, value) values ('messenger_relay_last_seen', now()::text)
   on conflict (key) do update set value = excluded.value;
   if coalesce((select value from public.telegram_bot_settings where key = 'messenger_relay_enabled'), '') <> 'true' then
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
   returning s.id, c.contact_id, c.first_name, c.amount_text, c.due_text, c.kind;
end;
$$;

create or replace function public.messenger_relay_report(p_token text, p_id bigint, p_status text, p_detail text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
   if not private.messenger_relay_token_ok(p_token) then raise exception 'forbidden'; end if;
   if p_status not in ('sent', 'failed', 'released') then raise exception 'bad status'; end if;
   -- 'released': the relay couldn't try (logged out), so the attempt doesn't count.
   update public.messenger_reminder_sends
      set status = case when p_status = 'released' then 'failed' else p_status end,
          attempts = case when p_status = 'released' then greatest(attempts - 1, 0) else attempts end,
          detail = left(p_detail, 500), sent_at = case when p_status = 'sent' then now() end
    where id = p_id and status = 'sending';
end;
$$;

-- Relay → team Telegram (logged out, page changed…). At most one alert every 3 hours.
create or replace function public.messenger_relay_alert(p_token text, p_text text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_last text;
begin
   if not private.messenger_relay_token_ok(p_token) then raise exception 'forbidden'; end if;
   select value into v_last from public.telegram_bot_settings where key = 'messenger_relay_last_alert';
   if v_last ~ '^\d{4}-' and v_last::timestamptz > now() - interval '3 hours' then return false; end if;
   insert into public.telegram_bot_settings (key, value) values ('messenger_relay_last_alert', now()::text)
   on conflict (key) do update set value = excluded.value;
   return private.viber_team_post('📨 Messenger reminder relay (George''s Mac): ' || left(p_text, 1500));
end;
$$;

revoke all on function public.messenger_relay_claim(text) from public;
revoke all on function public.messenger_relay_report(text, bigint, text, text) from public;
revoke all on function public.messenger_relay_alert(text, text) from public;
grant execute on function public.messenger_relay_claim(text) to anon, authenticated;
grant execute on function public.messenger_relay_report(text, bigint, text, text) to anon, authenticated;
grant execute on function public.messenger_relay_alert(text, text) to anon, authenticated;

-- 11:00 Bangkok: what's due today and not sent → team Telegram to send by hand (once per reminder).
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
   )
   select count(*), string_agg(
            '• ' || h.first_name || coalesce(' (👤 ' || h.facebook_name || ')', '') || ' @' || coalesce(h.username, '?')
            || ': ' || h.amount_text || ', due ' || h.due_text
            || case h.kind when 'due_2d' then ' (in 2 days)' when 'due_today' then ' (today)' else ' (overdue)' end
            || coalesce(' ⚠️ ' || h.detail, ''),
            E'\n')
     into v_n, v_text
     from handed h;
   if coalesce(v_n, 0) = 0 then return; end if;
   perform private.viber_team_post(
      '📨 Send the Messenger repay reminder by hand (' || v_n || '), the Mac relay didn''t:' || E'\n\n' || v_text
      || E'\n\nSendPulse → Campaigns → Create → Entire audience (by template) → moodeng_repay_reminder → Name equals their Facebook name → check 1 recipient.');
end;
$$;
revoke all on function private.messenger_reminder_watchdog() from public, anon, authenticated;

select cron.schedule('messenger-reminder-watchdog', '0 4 * * *', $$select private.messenger_reminder_watchdog()$$);
