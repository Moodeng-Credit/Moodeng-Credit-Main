-- World ID holders skip the embedded-wallet MINT face scan too (mirrors the cash-out gate
-- exemption in 20260919000000).
--
-- The mint scan (liveness + 1:N face search, see 20260811000000) is an anti-Sybil / cost control:
-- every embedded wallet is a paymaster-sponsored smart account, and the scan turns "one wallet
-- per account" into "one wallet per person". World ID is proof-of-personhood (one human = one
-- World ID, unique nullifier, hard to duplicate) — exactly that property — so a World ID holder
-- does not additionally need the face scan. This is an ADDITIVE bypass: it forces no one onto
-- World ID; users without it (incl. Didit KYC users) still scan exactly as before.
--
-- is_world_id is a server-only column (privileged-column trigger), so a client cannot self-set it
-- to bypass the scan.
--
-- Touches BOTH mint functions, because they gate in two steps:
--   1. may_mint_embedded_wallet   — "are you allowed to mint" (add a WORLD_ID allow branch)
--   2. claim_embedded_wallet_grant — "record the grant"; today it only inserts the grant when a
--      face approval flips APPROVED->CONSUMED. A World ID user never scanned, so without a matching
--      branch here they'd be allowed to mint but never granted (half-state). Add a World ID path
--      that grants directly.
-- Definitions below are the live ones from 20260811000000 plus the World ID branch.

-- ---------------------------------------------------------------------------
-- 1. May this user mint an embedded wallet?
-- ---------------------------------------------------------------------------
create or replace function public.may_mint_embedded_wallet(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
   face_status text;
   has_grant   boolean;
begin
   select exists (select 1 from public.embedded_wallet_grants g where g.user_id = p_user_id)
     into has_grant;

   -- Recovery of an already-granted wallet is always allowed.
   if has_grant then
      return jsonb_build_object('allowed', true, 'reason', 'ALREADY_GRANTED', 'already_granted', true);
   end if;

   -- World ID holders skip the mint face scan: World ID's proof-of-personhood is the
   -- one-wallet-per-person property this scan exists to enforce.
   if coalesce((select u.is_world_id = 'ACTIVE' from public.users u where u.id = p_user_id), false) then
      return jsonb_build_object('allowed', true, 'reason', 'WORLD_ID', 'already_granted', false);
   end if;

   select u.wallet_face_status into face_status
   from public.users u
   where u.id = p_user_id;

   if face_status = 'APPROVED' then
      return jsonb_build_object('allowed', true, 'reason', 'FACE_APPROVED', 'already_granted', false);
   end if;

   return jsonb_build_object(
      'allowed', false,
      'already_granted', false,
      'reason', case face_status
                   when 'DUPLICATE' then 'FACE_DUPLICATE'
                   when 'MISMATCH'  then 'FACE_MISMATCH'
                   when 'DECLINED'  then 'FACE_DECLINED'
                   when 'PENDING'   then 'FACE_PENDING'
                   when 'CONSUMED'  then 'FACE_REQUIRED'
                   else 'FACE_REQUIRED'
                end);
end;
$$;

revoke all on function public.may_mint_embedded_wallet(uuid) from public;
revoke all on function public.may_mint_embedded_wallet(uuid) from anon;
revoke all on function public.may_mint_embedded_wallet(uuid) from authenticated;
grant execute on function public.may_mint_embedded_wallet(uuid) to service_role, postgres;

-- ---------------------------------------------------------------------------
-- 2. Claim the grant (record that this account has an embedded wallet).
-- ---------------------------------------------------------------------------
create or replace function public.claim_embedded_wallet_grant(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
   is_world boolean;
begin
   -- Normal path: spend the face approval atomically (APPROVED -> CONSUMED), then insert the grant.
   update public.users
      set wallet_face_status = 'CONSUMED'
    where id = p_user_id
      and wallet_face_status = 'APPROVED';

   if found then
      insert into public.embedded_wallet_grants (user_id, user_role, face_session_id, wallet_address)
      select p_user_id, u.user_role::text, u.wallet_face_session_id, lower(btrim(nullif(u.wallet_address, '')))
      from public.users u
      where u.id = p_user_id
      on conflict (user_id) do nothing;
      return true;
   end if;

   -- World ID path: no face scan to spend. World ID stands in for the one-wallet-per-person
   -- check, so grant directly. Idempotent via the embedded_wallet_grants user_id primary key.
   select coalesce((select u.is_world_id = 'ACTIVE' from public.users u where u.id = p_user_id), false)
     into is_world;
   if is_world then
      insert into public.embedded_wallet_grants (user_id, user_role, face_session_id, wallet_address)
      select p_user_id, u.user_role::text, null, lower(btrim(nullif(u.wallet_address, '')))
      from public.users u
      where u.id = p_user_id
      on conflict (user_id) do nothing;
      return true;
   end if;

   return false;
end;
$$;

revoke all on function public.claim_embedded_wallet_grant(uuid) from public;
revoke all on function public.claim_embedded_wallet_grant(uuid) from anon;
revoke all on function public.claim_embedded_wallet_grant(uuid) from authenticated;
grant execute on function public.claim_embedded_wallet_grant(uuid) to service_role, postgres;
