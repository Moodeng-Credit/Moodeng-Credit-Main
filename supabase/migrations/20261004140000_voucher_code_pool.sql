-- GrabFood voucher code pool.
--
-- The team buys GrabFood codes in batches (e.g. GrabGifts for Business) and pastes them in on the admin
-- Vouchers page. Approving a claim (✅ Send code on the Telegram card or the admin page) takes the next
-- unused code of the claim's value, marks the claim sent and emails the code to the borrower. If the
-- email can't be sent, release_voucher_code puts the code back and the claim stays pending.

create table if not exists public.voucher_codes (
  id          uuid primary key default gen_random_uuid(),
  amount_php  numeric(10, 2) not null check (amount_php > 0),
  code        text not null unique check (code = btrim(code) and char_length(code) between 4 and 500),
  source      text,
  added_by    uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- assigned_at marks the code used for good: it stays set even if the claim is later deleted.
  claim_id    uuid unique references public.voucher_claims(id) on delete set null,
  assigned_at timestamptz
);

create index if not exists voucher_codes_available_idx
  on public.voucher_codes (amount_php, created_at)
  where assigned_at is null;

alter table public.voucher_codes enable row level security;
-- No policies: codes are read and handed out only by the functions below.

-- Admin: add a batch of codes of one value. Blank lines and codes already in the pool are skipped.
create or replace function public.admin_add_voucher_codes(p_amount_php numeric, p_codes text[], p_source text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_added integer;
  v_total integer;
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'not authorized';
  end if;
  if p_amount_php is null or p_amount_php <= 0 then
    raise exception 'the voucher value must be positive';
  end if;

  with input as (
    select distinct btrim(c) as code from unnest(coalesce(p_codes, '{}'::text[])) as c where btrim(c) <> ''
  ), ins as (
    insert into public.voucher_codes (amount_php, code, source, added_by)
    select p_amount_php, i.code, nullif(btrim(p_source), ''), auth.uid() from input i
    on conflict (code) do nothing
    returning 1
  )
  select (select count(*) from ins), (select count(*) from input) into v_added, v_total;

  return jsonb_build_object('added', v_added, 'skipped', v_total - v_added);
end;
$$;

-- Admin: how many codes are left (and used) per value.
create or replace function public.admin_voucher_code_stock()
returns table (amount_php numeric, available bigint, used bigint)
language sql
stable
security definer
set search_path to ''
as $$
  select c.amount_php,
         count(*) filter (where c.assigned_at is null),
         count(*) filter (where c.assigned_at is not null)
    from public.voucher_codes as c
   where app_private.is_moodeng_admin()
   group by c.amount_php
   order by c.amount_php;
$$;

-- Server only (edge functions): hand the next unused code of the claim's value to a pending claim.
create or replace function public.assign_voucher_code(p_claim_id uuid, p_admin text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_claim public.voucher_claims;
  v_code  public.voucher_codes;
  v_left  bigint;
begin
  select * into v_claim from public.voucher_claims where id = p_claim_id for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_claim.status <> 'pending' then
    return jsonb_build_object('error', 'not_pending', 'status', v_claim.status);
  end if;

  select * into v_code
    from public.voucher_codes
   where assigned_at is null and amount_php = v_claim.amount_php
   order by created_at, id
   limit 1
   for update skip locked;
  if not found then
    return jsonb_build_object('error', 'out_of_stock', 'amount_php', v_claim.amount_php);
  end if;

  update public.voucher_codes set claim_id = v_claim.id, assigned_at = now() where id = v_code.id;
  update public.voucher_claims
     set status = 'sent',
         sent_at = now(),
         admin_note = left(concat_ws(' · ', nullif(admin_note, ''), 'Code emailed by ' || coalesce(nullif(btrim(p_admin), ''), 'admin')), 500)
   where id = v_claim.id;

  select count(*) into v_left from public.voucher_codes where assigned_at is null and amount_php = v_claim.amount_php;

  return jsonb_build_object(
    'code', v_code.code,
    'amount_php', v_claim.amount_php,
    'email', v_claim.email,
    'full_name', v_claim.full_name,
    'reward', v_claim.reward,
    'user_id', v_claim.user_id,
    'remaining', v_left
  );
end;
$$;

-- Server only: undo assign_voucher_code when the email couldn't be sent.
create or replace function public.release_voucher_code(p_claim_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.voucher_codes set claim_id = null, assigned_at = null where claim_id = p_claim_id;
  update public.voucher_claims
     set status = 'pending',
         sent_at = null,
         admin_note = left(concat_ws(' · ', nullif(admin_note, ''), 'Email failed, code returned: ' || coalesce(p_reason, '?')), 500)
   where id = p_claim_id and status = 'sent';
end;
$$;

revoke all on function public.assign_voucher_code(uuid, text) from public, anon, authenticated;
revoke all on function public.release_voucher_code(uuid, text) from public, anon, authenticated;
grant execute on function public.assign_voucher_code(uuid, text) to service_role;
grant execute on function public.release_voucher_code(uuid, text) to service_role;

revoke all on function public.admin_add_voucher_codes(numeric, text[], text) from public, anon;
revoke all on function public.admin_voucher_code_stock() from public, anon;
grant execute on function public.admin_add_voucher_codes(numeric, text[], text) to authenticated;
grant execute on function public.admin_voucher_code_stock() to authenticated;
