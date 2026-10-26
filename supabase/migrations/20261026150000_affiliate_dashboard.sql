-- Affiliate dashboard (/affiliate): a referral code owner (e.g. Belle, BELLE) sees their own
-- referrals, what they earn per person, and what Moodeng still owes them — no admin access.
--
-- * referral_codes.payout_amount — what the owner earns per referred person who takes a loan and
--   repays it (default $10 = $5 on loan + $5 on repay). Set per code in Admin → Referral codes.
-- * referral_code_payouts.amount — the rate snapshotted when the payout row is created, so changing
--   a code's rate later never rewrites what was already earned.
-- * public.my_affiliate_dashboard() — security definer, scoped to auth.uid(); returns first names
--   only, never emails/phones/user ids of the referred people.

alter table public.referral_codes
  add column if not exists payout_amount numeric(18, 2) not null default 10
  check (payout_amount >= 0);

alter table public.referral_code_payouts
  add column if not exists amount numeric(18, 2);

update public.referral_code_payouts p
set amount = rc.payout_amount
from public.referral_codes rc
where rc.id = p.referral_code_id and p.amount is null;

create or replace function private.fill_referral_payout_amount()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  if new.amount is null then
    select payout_amount into new.amount from public.referral_codes where id = new.referral_code_id;
  end if;
  return new;
end;
$$;

revoke all on function private.fill_referral_payout_amount() from public, anon, authenticated;

drop trigger if exists fill_referral_payout_amount on public.referral_code_payouts;
create trigger fill_referral_payout_amount
  before insert on public.referral_code_payouts
  for each row execute function private.fill_referral_payout_amount();

create or replace function public.my_affiliate_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = 'public'
as $$
  with me as (
    select auth.uid() as id
  ),
  my_codes as (
    select rc.id, rc.code, rc.boost_amount, rc.payout_amount, rc.is_active, rc.expires_at, rc.max_uses, rc.current_uses
    from public.referral_codes rc, me
    where me.id is not null and rc.owner_user_id = me.id
  ),
  referred as (
    select
      u.id,
      c.id as code_id,
      c.code,
      c.payout_amount as code_payout_amount,
      u.created_at,
      coalesce(
        nullif(split_part(trim(u.display_name), ' ', 1), ''),
        nullif(trim(u.username), ''),
        'Friend'
      ) as first_name
    from public.users u
    join my_codes c on c.id = u.redeemed_referral_code_id, me
    where u.id <> me.id
  ),
  rows as (
    select
      r.first_name,
      r.code,
      r.created_at,
      exists (
        select 1 from public.loans l
        where l.borrower_user_id = r.id
          and l.funded_at is not null
          and l.refunded_at is null
          and not coalesce(l.is_test, false)
      ) as borrowed,
      p.id is not null as repaid,
      coalesce(p.amount, r.code_payout_amount) as payout_amount,
      p.status as payout_status,
      p.paid_at
    from referred r
    left join public.referral_code_payouts p on p.referred_user_id = r.id and p.referral_code_id = r.code_id
  )
  select jsonb_build_object(
    'codes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', code,
        'boost_amount', boost_amount,
        'payout_amount', payout_amount,
        'is_active', is_active and (expires_at is null or expires_at > now()) and (max_uses is null or current_uses < max_uses)
      ) order by code)
      from my_codes
    ), '[]'::jsonb),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'first_name', first_name,
        'code', code,
        'joined_at', created_at,
        'borrowed', borrowed,
        'repaid', repaid,
        'payout_amount', payout_amount,
        'payout_status', payout_status,
        'paid_at', paid_at
      ) order by created_at desc)
      from rows
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.my_affiliate_dashboard() from public, anon;
grant execute on function public.my_affiliate_dashboard() to authenticated;
