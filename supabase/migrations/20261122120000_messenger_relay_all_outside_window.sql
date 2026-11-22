-- Messenger repay-reminder template for EVERY borrower Messenger can't reach with a plain message.
--
-- Until now the relay (20261122030000) only sent moodeng_repay_reminder to Messenger-only borrowers
-- (no WhatsApp / Telegram / Viber / working push). On 2026-11-22, 33 of the 38 open-loan borrowers with
-- Messenger had not written to the Page in 24h, so Meta rejected every plain reminder to them
-- ("(#10) outside the allowed window"). The template is the one Messenger message that still arrives,
-- so it now goes to anyone outside the window, whatever other channels they have.

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
      -- Outside Messenger's 24h window (no message to the Page in the last 23h): Meta refuses the plain
      -- reminder, so the template goes. Inside it, loan-due-notifications' own message still arrives.
      and not exists (
             select 1 from public.messenger_contacts mc
              where mc.contact_id = u.messenger_psid and mc.last_seen_at > now() - interval '23 hours');
$$;
revoke all on function private.messenger_reminder_candidates() from public, anon, authenticated;
