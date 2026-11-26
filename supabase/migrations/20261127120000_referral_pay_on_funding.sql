-- Team codes that pay when a friend is funded, not when they repay (agreed with Mahjid, 2026-11-27):
-- "$5 for qualified leads that we verified and funded, paid on the 15th and 30th of every month."
--
-- Only NEW leads: referral_codes.pay_on_funded_from is the cutover. A friend whose account was made at or after
-- it earns the code's payout the moment their first loan is funded (funded = approved on the call + ID checked).
-- Friends from before it keep the old rule (create_referral_code_payout_on_repayment: repaid in the loan's last
-- 2 weeks). Null = the code works the old way only.
--
--   * referral_code_payouts.earned_on ('repaid' | 'funded') + loan_id.
--   * create_referral_code_payout_on_funding: loans trigger. A funding that is refunded before we pay takes the
--     unpaid $5 back off.
--   * No "pay now" card per funded friend. Instead a payday card to the team on the 15th and the 30th
--     (last day in February) at 09:00 Bangkok, listing what each owner is owed (affiliate-payday cron).
--   * affiliate_dashboard_for: funded_reward on each friend + pay_on_funding on the code, so /affiliate says
--     "funded — paid on the 15th/30th".
--   * affiliate_owed_items: the line says "funded" instead of "repaid".
--   * MAHJID switched on from now.

alter table public.referral_codes add column if not exists pay_on_funded_from timestamptz null;
comment on column public.referral_codes.pay_on_funded_from is
  'Friends whose account was made at/after this earn payout_amount when their first loan is funded (paid on the 15th/30th). Older friends: paid on repayment. Null = repayment only.';

alter table public.referral_code_payouts add column if not exists earned_on text not null default 'repaid';
alter table public.referral_code_payouts drop constraint if exists referral_code_payouts_earned_on_check;
alter table public.referral_code_payouts add constraint referral_code_payouts_earned_on_check check (earned_on in ('repaid', 'funded'));
alter table public.referral_code_payouts add column if not exists loan_id uuid null references public.loans(id) on delete set null;

-- Next payday on or after a Bangkok date: the 15th, or the 30th (the last day in February); the 31st → next 15th.
create or replace function app_private.affiliate_payday(p_day date)
returns date
language sql
immutable
set search_path to ''
as $$
  with m as (select date_trunc('month', p_day)::date as first)
  select case
    when p_day <= first + 14 then first + 14
    when p_day <= least(first + 29, (first + interval '1 month - 1 day')::date) then least(first + 29, (first + interval '1 month - 1 day')::date)
    else (first + interval '1 month 14 days')::date
  end from m;
$$;
revoke all on function app_private.affiliate_payday(date) from public, anon, authenticated;

create or replace function private.create_referral_code_payout_on_funding()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  rc public.referral_codes%rowtype;
  v_joined timestamptz;
begin
  -- Funding reversed before we paid → the $5 goes away (a later funded loan can earn it again).
  if new.refunded_at is not null then
    if tg_op = 'UPDATE' and old.refunded_at is null then
      delete from public.referral_code_payouts
      where loan_id = new.id and earned_on = 'funded' and status = 'unpaid';
    end if;
    return new;
  end if;

  if new.funded_at is null
     or (tg_op = 'UPDATE' and old.funded_at is not null)
     or coalesce(new.is_test, false) then
    return new;
  end if;

  select r.* into rc
  from public.users u
  join public.referral_codes r on r.id = u.redeemed_referral_code_id
  where u.id = new.borrower_user_id;
  if not found then
    return new;
  end if;
  select u.created_at into v_joined from public.users u where u.id = new.borrower_user_id;

  if v_joined is null
     or rc.pay_on_funded_from is null
     or v_joined < rc.pay_on_funded_from
     or rc.owner_user_id is null
     or rc.owner_user_id = new.borrower_user_id
     or rc.owner_user_id is not distinct from new.lender_user_id
     or coalesce(rc.payout_amount, 0) <= 0 then
    return new;
  end if;

  insert into public.referral_code_payouts (referral_code_id, code, owner_user_id, referred_user_id, earned_on, loan_id, amount)
  values (rc.id, rc.code, rc.owner_user_id, new.borrower_user_id, 'funded', new.id, rc.payout_amount)
  on conflict (referral_code_id, referred_user_id) do nothing;
  return new;
end;
$function$;
revoke all on function private.create_referral_code_payout_on_funding() from public, anon, authenticated;

drop trigger if exists create_referral_code_payout_on_funding on public.loans;
create trigger create_referral_code_payout_on_funding
  after insert or update of funded_at, refunded_at on public.loans
  for each row execute function private.create_referral_code_payout_on_funding();

-- Funded payouts wait for payday: no "pay now" card when they're made. Paid → stamp as before.
create or replace function private.notify_referral_code_payout()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare project_url text; service_key text; decided_by text; body jsonb;
begin
  if tg_op = 'INSERT' and new.earned_on = 'funded' then
    return new;
  end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;
  if project_url is null or service_key is null then
    raise warning 'Referral payout notification skipped: Supabase project URL or secret key missing from vault.';
    return new;
  end if;
  if tg_op = 'INSERT' then
    body := jsonb_build_object('payoutId', new.id);
  else
    select display_name into decided_by from public.admin_users where user_id = auth.uid() and active limit 1;
    body := jsonb_build_object('payoutId', new.id, 'event', 'decided', 'decidedBy', decided_by);
  end if;
  perform net.http_post(
    url := project_url || '/functions/v1/referral-payout-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := body);
  return new;
end; $function$;

-- 09:00 Bangkok every day; does something only on payday (or when forced) and only if a funded $5 is unpaid.
create or replace function private.affiliate_payday_tick(p_force boolean default false)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  project_url text;
  service_key text;
begin
  if not p_force and v_today <> app_private.affiliate_payday(v_today) then
    return false;
  end if;
  if not exists (select 1 from public.referral_code_payouts where earned_on = 'funded' and status = 'unpaid') then
    return false;
  end if;
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;
  if project_url is null or service_key is null then
    raise warning 'Affiliate payday skipped: project URL or secret key missing from vault.';
    return false;
  end if;
  perform net.http_post(
    url := project_url || '/functions/v1/referral-payout-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('payday', v_today));
  return true;
end;
$function$;
revoke all on function private.affiliate_payday_tick(boolean) from public, anon, authenticated;

select cron.unschedule('affiliate-payday') where exists (select 1 from cron.job where jobname = 'affiliate-payday');
select cron.schedule('affiliate-payday', '0 2 * * *', $c$select private.affiliate_payday_tick()$c$);

-- Owed lines (invoice + admin pay card): say "funded" for funded ones.
create or replace function app_private.affiliate_owed_items(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) from (
    select jsonb_build_object(
      'source', 'code', 'id', p.id,
      'amount', coalesce(p.amount, rc.payout_amount, 0),
      'label', p.code || ': ' || coalesce(nullif(trim(f.display_name), ''), '@' || f.username, 'a friend')
               || case when p.earned_on = 'funded' then ' funded' else ' repaid' end,
      'at', p.created_at) x
    from public.referral_code_payouts p
    join public.referral_codes rc on rc.id = p.referral_code_id
    left join public.users f on f.id = p.referred_user_id
    where p.owner_user_id = p_user and p.status = 'unpaid' and coalesce(p.amount, rc.payout_amount, 0) > 0
    union all
    select jsonb_build_object(
      'source', 'refund', 'id', r.id,
      'amount', r.amount_usd,
      'label', case when r.kind = 'bonus' then 'Bonus'
                    when r.kind = 'cash' then 'Invite link: ' || coalesce(nullif(trim(f.display_name), ''), '@' || f.username, 'a friend') || ' repaid'
                    else 'Interest refund' end,
      'at', r.created_at)
    from public.interest_refunds r
    left join public.friend_referrals fr on fr.id = r.friend_referral_id
    left join public.users f on f.id = fr.referred_user_id
    where r.user_id = p_user and r.status = 'pending' and r.amount_usd > 0
  ) s;
$$;
revoke all on function app_private.affiliate_owed_items(uuid) from public, anon, authenticated;

-- MAHJID: new leads from now on are paid when funded.
update public.referral_codes set pay_on_funded_from = now() where code = 'MAHJID' and pay_on_funded_from is null;

-- /affiliate: funded_reward per friend, pay_on_funding per code. Patched from the live definition so newer edits
-- to affiliate_dashboard_for are kept; each replacement must match or the migration stops.
do $patch$
declare
  v_def text;
  v_new text;
  v_edits text[][] := array[
    array['rc.max_uses, rc.current_uses
    from public.referral_codes rc',
          'rc.max_uses, rc.current_uses, rc.pay_on_funded_from
    from public.referral_codes rc'],
    array['''personal'', false
        ) as c
        from my_codes',
          '''personal'', false,
          ''pay_on_funding'', pay_on_funded_from is not null
        ) as c
        from my_codes'],
    array[') as call_missed
    from referred r',
          ') as call_missed,
      coalesce(p.earned_on = ''funded'', false) as funded_reward
    from referred r'],
    array['''call_missed'', call_missed
      ) order by created_at desc)',
          '''call_missed'', call_missed,
        ''funded_reward'', funded_reward
      ) order by created_at desc)']
  ];
  i int;
begin
  select pg_get_functiondef('app_private.affiliate_dashboard_for(uuid)'::regprocedure) into v_def;
  if position('funded_reward' in v_def) > 0 then
    return; -- already patched
  end if;
  v_new := v_def;
  for i in 1 .. array_length(v_edits, 1) loop
    if position(v_edits[i][1] in v_new) = 0 then
      raise exception 'affiliate_dashboard_for patch % did not match', i;
    end if;
    v_new := replace(v_new, v_edits[i][1], v_edits[i][2]);
  end loop;
  execute v_new;
end
$patch$;
