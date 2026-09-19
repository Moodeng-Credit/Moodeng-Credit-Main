-- World ID holders skip the first-cash-out face gate.
--
-- Rationale (product decision): World ID carries its own proof-of-personhood that is hard to
-- duplicate, so a holder does not additionally need the Didit face scan to move their first
-- cash-out. We barely issue World ID anymore, but where a user still has it we honour it.
--
-- This also closes a gap in the face gate itself: the gate 1:1-matches the live selfie against a
-- *Didit*-enrolled face, so a borrower who verified via World ID only (is_world_id ACTIVE, not
-- is_didit) had no reference to match and could never pass — they'd sit BLOCKED awaiting a manual
-- cashout_gate_exempt. Exempting World ID here removes that dead end.
--
-- Applied to BOTH gate functions so the withdraw-step check (cashout_face_gate_required) and the
-- wallet-usability hold (cashout_gate_holds_wallet) agree on who is in scope. The check goes
-- right after the admin exemption and before the funded/first-cashout/country logic, mirroring
-- the cashout_gate_exempt short-circuit. Definitions below are the LIVE ones from
-- 20260820110000 plus the World ID branch — no other drift.

-- ---------------------------------------------------------------------------
-- 1. Withdraw-step gate — authorises MOVING MONEY.
-- ---------------------------------------------------------------------------
create or replace function public.cashout_face_gate_required(
   p_user_id uuid,
   p_destination text,
   p_amount numeric,
   p_country_iso text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
   country text;
begin
   if not exists (select 1 from public.embedded_wallet_grants g where g.user_id = p_user_id) then
      return jsonb_build_object('required', false, 'reason', 'NOT_EMBEDDED_WALLET');
   end if;

   if coalesce((select u.cashout_gate_exempt from public.users u where u.id = p_user_id), false) then
      return jsonb_build_object('required', false, 'reason', 'EXEMPT');
   end if;

   -- World ID holders are out of scope: their own proof-of-personhood stands in for the scan.
   if coalesce((select u.is_world_id = 'ACTIVE' from public.users u where u.id = p_user_id), false) then
      return jsonb_build_object('required', false, 'reason', 'WORLD_ID');
   end if;

   if not exists (
      select 1 from public.loans l
      where l.borrower_user_id = p_user_id
        and l.loan_status = 'Lent'
   ) then
      return jsonb_build_object('required', false, 'reason', 'NOT_FUNDED');
   end if;

   if exists (select 1 from public.withdrawals w where w.borrower_user_id = p_user_id) then
      return jsonb_build_object('required', false, 'reason', 'NOT_FIRST_CASHOUT');
   end if;

   -- An APPROVED, unspent, unexpired check bound to THIS destination + amount.
   if exists (
      select 1 from public.cashout_face_checks c
      where c.user_id = p_user_id
        and c.status = 'APPROVED'
        and c.consumed_at is null
        and c.expires_at > now()
        and c.destination_address = p_destination
        and c.amount = p_amount
   ) then
      return jsonb_build_object('required', false, 'reason', 'HAS_VALID_CHECK');
   end if;

   -- Country LAST. Unknown FAILS CLOSED here (gated) — the money-moving action.
   country := upper(coalesce(nullif(btrim(p_country_iso), ''), ''));
   if country = '' then
      select upper(a.country_iso) into country
      from public.auth_ip_log a
      where a.user_id = p_user_id
        and a.country_iso is not null
      order by a.last_seen_at desc
      limit 1;
   end if;
   if coalesce(country, '') not in ('PH', '') then
      return jsonb_build_object('required', false, 'reason', 'NOT_PH');
   end if;

   return jsonb_build_object('required', true, 'reason', 'FACE_REQUIRED');
end;
$$;

revoke all on function public.cashout_face_gate_required(uuid, text, numeric, text) from public;
revoke all on function public.cashout_face_gate_required(uuid, text, numeric, text) from anon;
revoke all on function public.cashout_face_gate_required(uuid, text, numeric, text) from authenticated;
grant execute on function public.cashout_face_gate_required(uuid, text, numeric, text) to service_role, postgres;

-- ---------------------------------------------------------------------------
-- 2. Wallet-usability hold — authorises USING THE EMBEDDED WALLET AT ALL.
-- ---------------------------------------------------------------------------
create or replace function public.cashout_gate_holds_wallet(
   p_user_id uuid,
   p_country_iso text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
   country text;
begin
   if not exists (select 1 from public.embedded_wallet_grants g where g.user_id = p_user_id) then
      return jsonb_build_object('held', false, 'reason', 'NOT_EMBEDDED_WALLET');
   end if;

   if coalesce((select u.cashout_gate_exempt from public.users u where u.id = p_user_id), false) then
      return jsonb_build_object('held', false, 'reason', 'EXEMPT');
   end if;

   -- World ID holders are out of scope: their own proof-of-personhood stands in for the scan.
   if coalesce((select u.is_world_id = 'ACTIVE' from public.users u where u.id = p_user_id), false) then
      return jsonb_build_object('held', false, 'reason', 'WORLD_ID');
   end if;

   if not exists (
      select 1 from public.loans l
      where l.borrower_user_id = p_user_id
        and l.loan_status = 'Lent'
   ) then
      return jsonb_build_object('held', false, 'reason', 'NOT_FUNDED');
   end if;

   if exists (select 1 from public.withdrawals w where w.borrower_user_id = p_user_id) then
      return jsonb_build_object('held', false, 'reason', 'NOT_FIRST_CASHOUT');
   end if;

   -- Live request-IP country first, most recent enriched login as fallback. Unknown FAILS OPEN
   -- here (not held) — bricking every embedded wallet on a geo outage is worse than the gap.
   country := upper(coalesce(nullif(btrim(p_country_iso), ''), ''));
   if country = '' then
      select upper(a.country_iso) into country
      from public.auth_ip_log a
      where a.user_id = p_user_id
        and a.country_iso is not null
      order by a.last_seen_at desc
      limit 1;
   end if;
   if coalesce(country, '') <> 'PH' then
      return jsonb_build_object('held', false, 'reason', 'NOT_PH');
   end if;

   -- A face check passed in the last 24h releases the wallet.
   if exists (
      select 1 from public.cashout_face_checks c
      where c.user_id = p_user_id
        and c.status in ('APPROVED', 'CONSUMED')
        and c.checked_at > now() - interval '24 hours'
   ) then
      return jsonb_build_object('held', false, 'reason', 'RECENTLY_PASSED');
   end if;

   return jsonb_build_object('held', true, 'reason', 'CASHOUT_FACE_REQUIRED');
end;
$$;

revoke all on function public.cashout_gate_holds_wallet(uuid, text) from public;
revoke all on function public.cashout_gate_holds_wallet(uuid, text) from anon;
revoke all on function public.cashout_gate_holds_wallet(uuid, text) from authenticated;
grant execute on function public.cashout_gate_holds_wallet(uuid, text) to service_role, postgres;
