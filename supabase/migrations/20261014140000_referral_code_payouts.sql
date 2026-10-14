-- When someone redeems a referral code that has an owner (referral_codes.owner_user_id), the owner
-- is owed a payout. One row per redemption; the team marks it Paid from the admin panel or the
-- Telegram card (referral-payout-telegram-notification).
create table if not exists public.referral_code_payouts (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete cascade,
  code text not null,
  owner_user_id uuid references public.users(id) on delete set null,
  referred_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at timestamptz,
  paid_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (referral_code_id, referred_user_id)
);

create index if not exists idx_referral_code_payouts_unpaid
  on public.referral_code_payouts (created_at) where status = 'unpaid';

alter table public.referral_code_payouts enable row level security;

drop policy if exists "admins manage referral code payouts" on public.referral_code_payouts;
create policy "admins manage referral code payouts" on public.referral_code_payouts
  for all to authenticated
  using (app_private.is_moodeng_admin())
  with check (app_private.is_moodeng_admin());

drop trigger if exists update_referral_code_payouts_updated_at on public.referral_code_payouts;
create trigger update_referral_code_payouts_updated_at before update on public.referral_code_payouts
  for each row execute function public.update_updated_at_column();

-- A user redeemed a code (redeem_referral_code sets users.redeemed_referral_code_id) → owe its owner.
create or replace function private.create_referral_code_payout()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  rc public.referral_codes%rowtype;
begin
  select * into rc from public.referral_codes where id = new.redeemed_referral_code_id;
  if not found or rc.owner_user_id is null or rc.owner_user_id = new.id then
    return new;
  end if;
  insert into public.referral_code_payouts (referral_code_id, code, owner_user_id, referred_user_id)
  values (rc.id, rc.code, rc.owner_user_id, new.id)
  on conflict (referral_code_id, referred_user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_referral_code_payout() from public, anon, authenticated;

drop trigger if exists create_referral_code_payout on public.users;
create trigger create_referral_code_payout
  after update of redeemed_referral_code_id on public.users
  for each row
  when (old.redeemed_referral_code_id is null and new.redeemed_referral_code_id is not null)
  execute function private.create_referral_code_payout();

-- New payout → Telegram card (✅ Paid / ⏳ Not paid yet). Paid in the admin panel → stamp the card.
-- Same vault-secret pattern as private.notify_voucher_claim_telegram.
create or replace function private.notify_referral_code_payout()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'vault', 'net'
as $$
declare
  project_url text;
  service_key text;
  decided_by text;
  body jsonb;
begin
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
    body := body
  );
  return new;
end;
$$;

revoke all on function private.notify_referral_code_payout() from public, anon, authenticated;

drop trigger if exists notify_referral_code_payout on public.referral_code_payouts;
create trigger notify_referral_code_payout
  after insert on public.referral_code_payouts
  for each row execute function private.notify_referral_code_payout();

drop trigger if exists notify_referral_code_payout_decided on public.referral_code_payouts;
create trigger notify_referral_code_payout_decided
  after update of status on public.referral_code_payouts
  for each row
  when (old.status is distinct from new.status)
  execute function private.notify_referral_code_payout();
