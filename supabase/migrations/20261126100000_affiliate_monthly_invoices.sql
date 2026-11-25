-- Monthly affiliate invoices.
--
-- At the end of each month an affiliate taps "Send my invoice" on /affiliate. The invoice is a snapshot
-- of every friend payout still owed to them (referral_code_payouts 'unpaid' + interest_refunds 'pending'),
-- minus money already paid ahead, plus the wallet to pay. Sending it posts a card to the admin Telegram
-- chat (kyc_alert_chat_id, where payout cards already go) so the team knows who to pay and how much.
--
-- Window (Bangkok time): from the 25th to the end of the month bills that month; the 1st–5th still bills
-- the month before (late invoices). One invoice per person per month.
-- An invoice counts as paid once none of its lines are still owed (paid in Admin → Affiliate payouts).

create table if not exists public.affiliate_invoices (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  month date not null,
  owed numeric(10, 2) not null,
  ahead numeric(10, 2) not null default 0,
  amount numeric(10, 2) not null,
  items jsonb not null default '[]'::jsonb,
  wallet_address text null,
  note text null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, month)
);
alter table public.affiliate_invoices enable row level security;
revoke all on public.affiliate_invoices from anon, authenticated;
grant select on public.affiliate_invoices to authenticated;
drop policy if exists affiliate_invoices_admin on public.affiliate_invoices;
create policy affiliate_invoices_admin on public.affiliate_invoices
  for select to authenticated using (app_private.is_moodeng_admin());
drop policy if exists affiliate_invoices_own on public.affiliate_invoices;
create policy affiliate_invoices_own on public.affiliate_invoices
  for select to authenticated using (owner_user_id = auth.uid());

-- Month an invoice can be sent for right now, or null outside the window.
create or replace function app_private.affiliate_invoice_month(p_at timestamptz default now())
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  with d as (select (p_at at time zone 'Asia/Bangkok')::date as day)
  select case
    when extract(day from day) >= 25 then date_trunc('month', day)::date
    when extract(day from day) <= 5 then (date_trunc('month', day) - interval '1 month')::date
    else null
  end from d;
$$;
revoke all on function app_private.affiliate_invoice_month(timestamptz) from public, anon, authenticated;

-- Every line still owed to this person: [{source, id, amount, label, at}].
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
      'label', p.code || ': ' || coalesce(nullif(trim(f.display_name), ''), '@' || f.username, 'a friend') || ' repaid',
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

-- True once no line of the invoice is still owed.
create or replace function app_private.affiliate_invoice_paid(p_items jsonb)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from jsonb_array_elements(p_items) i
    where (i->>'source' = 'code' and exists (select 1 from public.referral_code_payouts p where p.id = (i->>'id')::uuid and p.status = 'unpaid'))
       or (i->>'source' = 'refund' and exists (select 1 from public.interest_refunds r where r.id = (i->>'id')::uuid and r.status = 'pending'))
  );
$$;
revoke all on function app_private.affiliate_invoice_paid(jsonb) from public, anon, authenticated;

-- What /affiliate shows: the open month, what an invoice would say now, and past invoices.
create or replace function app_private.affiliate_invoice_state(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_items jsonb := app_private.affiliate_owed_items(p_user);
  v_owed numeric := coalesce((select sum((i->>'amount')::numeric) from jsonb_array_elements(v_items) i), 0);
  v_ahead numeric := least(v_owed, app_private.affiliate_paid_ahead(p_user));
begin
  return jsonb_build_object(
    'open_month', app_private.affiliate_invoice_month(),
    'owed', round(v_owed, 2),
    'ahead', round(v_ahead, 2),
    'amount', round(v_owed - v_ahead, 2),
    'items', v_items,
    'wallet_address', (select wallet_address from public.users where id = p_user),
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'month', month, 'amount', amount, 'items', items, 'created_at', created_at,
        'paid', app_private.affiliate_invoice_paid(items)) order by month desc)
      from public.affiliate_invoices where owner_user_id = p_user), '[]'::jsonb)
  );
end;
$$;
revoke all on function app_private.affiliate_invoice_state(uuid) from public, anon, authenticated;

create or replace function public.my_affiliate_invoice()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.affiliate_invoice_state(auth.uid()) where auth.uid() is not null;
$$;
revoke all on function public.my_affiliate_invoice() from public, anon;
grant execute on function public.my_affiliate_invoice() to authenticated;

-- Send this month's invoice. Errors are short words the page turns into plain text.
create or replace function public.submit_affiliate_invoice(p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_month date := app_private.affiliate_invoice_month();
  v_state jsonb;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if v_month is null then raise exception 'invoice_window_closed' using errcode = 'P0001'; end if;
  if exists (select 1 from public.affiliate_invoices where owner_user_id = v_user and month = v_month) then
    raise exception 'invoice_already_sent' using errcode = 'P0001';
  end if;
  v_state := app_private.affiliate_invoice_state(v_user);
  if (v_state->>'amount')::numeric <= 0 then raise exception 'nothing_owed' using errcode = 'P0001'; end if;

  insert into public.affiliate_invoices (owner_user_id, month, owed, ahead, amount, items, wallet_address, note)
  values (v_user, v_month, (v_state->>'owed')::numeric, (v_state->>'ahead')::numeric, (v_state->>'amount')::numeric,
          v_state->'items', v_state->>'wallet_address', nullif(left(trim(coalesce(p_note, '')), 500), ''))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'month', v_month, 'amount', (v_state->>'amount')::numeric);
end;
$$;
revoke all on function public.submit_affiliate_invoice(text) from public, anon;
grant execute on function public.submit_affiliate_invoice(text) to authenticated;

-- Admins: invoices from the last 3 months with paid status (Admin → Affiliate payouts).
create or replace function public.admin_affiliate_invoices()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'owner_user_id', i.owner_user_id, 'month', i.month, 'amount', i.amount, 'owed', i.owed,
      'ahead', i.ahead, 'items', i.items, 'wallet_address', i.wallet_address, 'note', i.note,
      'created_at', i.created_at, 'paid', app_private.affiliate_invoice_paid(i.items),
      'username', u.username, 'display_name', u.display_name) order by i.created_at desc)
    from public.affiliate_invoices i join public.users u on u.id = i.owner_user_id
    where i.month >= (date_trunc('month', now()) - interval '3 months')::date), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_affiliate_invoices() from public, anon;
grant execute on function public.admin_affiliate_invoices() to authenticated;

-- New invoice → Telegram card for the team.
create or replace function private.notify_affiliate_invoice()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'vault', 'net'
as $$
declare
  project_url text;
  service_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;
  if project_url is null or service_key is null then
    raise warning 'Affiliate invoice notification skipped: project URL or secret key missing from vault.';
    return new;
  end if;
  perform net.http_post(
    url := project_url || '/functions/v1/referral-payout-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('invoiceId', new.id)
  );
  return new;
exception when others then
  raise warning 'Affiliate invoice notification failed: %', sqlerrm;
  return new;
end;
$$;
revoke all on function private.notify_affiliate_invoice() from public, anon, authenticated;

drop trigger if exists notify_affiliate_invoice on public.affiliate_invoices;
create trigger notify_affiliate_invoice
  after insert on public.affiliate_invoices
  for each row execute function private.notify_affiliate_invoice();
