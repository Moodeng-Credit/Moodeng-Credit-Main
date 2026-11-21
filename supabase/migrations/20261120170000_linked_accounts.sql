-- Repeat / mule / family accounts (George 2026-11-20: "systems to stop people from coming back in and
-- check for mule accounts or family accounts"). linked_accounts(user) lists other accounts tied to this
-- one by a strong signal, and whether each is "bad" (rejected, ghosted, blocked, blacklisted, or a loan
-- 3+ days overdue). Used by the pre-screening auto-✅ (a bad link is a red flag) and by the 30-minute
-- linked-accounts sweep that warns the team about new sign-ups linked to bad accounts.
--
-- Signals (strong only — Philippine mobile data shares IPs across thousands of people):
--   same device (auth_device_log) · same home internet (one IP, same day, ≤3 accounts on it) ·
--   same WhatsApp number · same Facebook (Messenger contact or profile URL) · same wallet / payout
--   address · the ID check's identity matches (same person / document / address / family district).

create or replace function public.linked_accounts(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (select * from public.users where id = p_user),
  links as (
    select d2.user_id as other, 'same phone/device' as via
      from public.auth_device_log d1
      join public.auth_device_log d2 on d2.device_hash = d1.device_hash and d2.user_id <> d1.user_id
     where d1.user_id = p_user
    union all
    select i2.user_id, 'same home internet'
      from public.auth_ip_log i1
      join public.auth_ip_log i2 on i2.ip_hash = i1.ip_hash and i2.seen_on = i1.seen_on and i2.user_id <> i1.user_id
     where i1.user_id = p_user
       and not coalesce(i1.is_hosting, false)
       and (select count(distinct x.user_id) from public.auth_ip_log x where x.ip_hash = i1.ip_hash and x.seen_on = i1.seen_on) <= 3
    union all
    select u.id, 'same WhatsApp number' from public.users u, me
     where me.whatsapp_number is not null and btrim(me.whatsapp_number) <> '' and u.whatsapp_number = me.whatsapp_number and u.id <> me.id
    union all
    select u.id, 'same Facebook' from public.users u, me
     where me.messenger_psid is not null and u.messenger_psid = me.messenger_psid and u.id <> me.id
    union all
    select u.id, 'same Facebook profile' from public.users u, me
     where me.facebook_profile_url is not null and btrim(me.facebook_profile_url) <> ''
       and lower(rtrim(u.facebook_profile_url, '/')) = lower(rtrim(me.facebook_profile_url, '/')) and u.id <> me.id
    union all
    select u.id, 'same wallet' from public.users u, me
     where me.wallet_address is not null and lower(u.wallet_address) = lower(me.wallet_address) and u.id <> me.id
    union all
    select u.id, 'same payout address' from public.users u, me
     where u.id <> me.id
       and ((me.walt_address is not null and lower(u.walt_address) = lower(me.walt_address))
         or (me.maya_address is not null and lower(u.maya_address) = lower(me.maya_address)))
    union all
    select case when m.user_a = p_user then m.user_b else m.user_a end,
           'ID check: ' || replace(m.kind, '_', ' ')
      from public.kyc_identity_matches m
     where p_user in (m.user_a, m.user_b) and m.kind <> 'didit_warning'
  ),
  grouped as (
    select other, array_agg(distinct via order by via) as vias from links where other is not null and other <> p_user group by other
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', u.id,
           'username', u.username,
           'status', u.loan_access_status,
           'via', g.vias,
           'bad', (u.loan_access_status = 'rejected' or u.ghosted_at is not null
                   or u.account_status in ('blocked', 'banned')
                   or exists (select 1 from public.kyc_blacklist b where b.user_id = u.id)
                   or exists (select 1 from public.loans l where l.borrower_user_id = u.id and l.loan_status = 'Lent'
                                and l.repayment_status::text <> 'Paid' and l.refunded_at is null and l.due_date < now() - interval '3 days')),
           'why', concat_ws(', ',
                   case when u.loan_access_status = 'rejected' then 'rejected' end,
                   case when u.ghosted_at is not null then 'ghosted' end,
                   case when u.account_status in ('blocked', 'banned') then u.account_status end,
                   case when exists (select 1 from public.kyc_blacklist b where b.user_id = u.id) then 'blacklisted' end,
                   case when exists (select 1 from public.loans l where l.borrower_user_id = u.id and l.loan_status = 'Lent'
                                       and l.repayment_status::text <> 'Paid' and l.refunded_at is null and l.due_date < now() - interval '3 days') then 'loan overdue' end)
         ) order by u.created_at), '[]'::jsonb)
    from grouped g join public.users u on u.id = g.other
   where not coalesce(u.is_test, false);
$$;
revoke all on function public.linked_accounts(uuid) from public, anon, authenticated;
grant execute on function public.linked_accounts(uuid) to service_role;

-- One warning per new account (the sweep).
create table if not exists public.linked_account_alerts (
  user_id uuid primary key references public.users(id) on delete cascade,
  alerted_at timestamptz not null default now(),
  detail jsonb
);
alter table public.linked_account_alerts enable row level security;
revoke all on public.linked_account_alerts from anon, authenticated;

select cron.schedule('linked-accounts-sweep', '*/30 * * * *', $c$select app_private.pre_screening_call('{"linked_sweep": true}'::jsonb)$c$);
