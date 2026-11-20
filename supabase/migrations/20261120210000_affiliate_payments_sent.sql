-- Money actually sent to an affiliate (one transfer can cover several friends, or be paid ahead).
--
-- Before this, "Paid so far" on /affiliate only added up the friends marked paid, so a $20 sent when
-- $5 was owed (Irish, 2026-11-20) showed as $5 and the other $15 was invisible to her and to the team.
-- Now each transfer is a row here. Money paid ahead = what was sent minus what it has covered since the
-- first recorded transfer; the admin pay card uses it up before anyone sends again.

create table if not exists public.affiliate_payments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  tx_hash text null,
  sent_at timestamptz not null default now(),
  note text null,
  created_by text null,
  created_at timestamptz not null default now()
);
create index if not exists affiliate_payments_owner_idx on public.affiliate_payments (owner_user_id, sent_at);
alter table public.affiliate_payments enable row level security;
revoke all on public.affiliate_payments from anon, authenticated;
-- Admin panel records transfers (Send USDC / Mark paid).
grant select, insert on public.affiliate_payments to authenticated;
drop policy if exists affiliate_payments_admin on public.affiliate_payments;
create policy affiliate_payments_admin on public.affiliate_payments
  for all to authenticated
  using (app_private.is_moodeng_admin())
  with check (app_private.is_moodeng_admin());

-- Sent − covered (friend payouts paid / invite refunds sent since the first recorded transfer). Never < 0.
create or replace function app_private.affiliate_paid_ahead(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with since as (select min(sent_at) - interval '1 day' t from public.affiliate_payments where owner_user_id = p_user),
  sent as (select coalesce(sum(amount), 0) s from public.affiliate_payments where owner_user_id = p_user),
  covered as (
    select coalesce((select sum(coalesce(p.amount, rc.payout_amount, 0))
                       from public.referral_code_payouts p
                       join public.referral_codes rc on rc.id = p.referral_code_id, since
                      where p.owner_user_id = p_user and p.status = 'paid' and p.paid_at >= since.t), 0)
         + coalesce((select sum(r.amount_usd) from public.interest_refunds r, since
                      where r.user_id = p_user and r.status = 'sent' and r.sent_at >= since.t), 0) c
  )
  select greatest(0, round((select s from sent) - (select c from covered), 2));
$$;
revoke all on function app_private.affiliate_paid_ahead(uuid) from public, anon, authenticated;

create or replace function app_private.affiliate_payments_for(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('amount', amount, 'tx_hash', tx_hash, 'sent_at', sent_at, 'note', note) order by sent_at desc)
      from public.affiliate_payments where owner_user_id = p_user), '[]'::jsonb),
    'sent', coalesce((select sum(amount) from public.affiliate_payments where owner_user_id = p_user), 0),
    'ahead', app_private.affiliate_paid_ahead(p_user)
  );
$$;
revoke all on function app_private.affiliate_payments_for(uuid) from public, anon, authenticated;

-- Signed in: my transfers.
create or replace function public.my_affiliate_payments()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.affiliate_payments_for(auth.uid()) where auth.uid() is not null;
$$;
revoke all on function public.my_affiliate_payments() from public, anon;
grant execute on function public.my_affiliate_payments() to authenticated;

-- Admins: someone's transfers (user id or @username), like admin_affiliate_dashboard.
create or replace function public.admin_affiliate_payments(p_who text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_who text := lower(trim(both from ltrim(trim(coalesce(p_who, '')), '@')));
  v_id uuid;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if v_who ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := v_who::uuid;
  else
    select id into v_id from public.users where lower(username) = v_who order by created_at limit 1;
  end if;
  if v_id is null then
    raise exception 'No user found for %', p_who using errcode = 'P0002';
  end if;
  return app_private.affiliate_payments_for(v_id);
end;
$$;
revoke all on function public.admin_affiliate_payments(text) from public, anon;
grant execute on function public.admin_affiliate_payments(text) to authenticated;
