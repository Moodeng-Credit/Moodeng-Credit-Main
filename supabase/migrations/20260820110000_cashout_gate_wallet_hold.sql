-- Make the cash-out face gate (20260820100000) an actual enforcement boundary rather than a
-- withdraw-flow UI step.
--
-- The problem this closes: the embedded-wallet send is signed CLIENT-side
-- (Withdraw.tsx -> payUsdc -> sendUsdcFromEmbeddedWallet -> walletClient.writeContract), so a
-- check that lives in the withdraw flow can be walked around two ways:
--   1. src/views/account/ExportInstantWalletKey.tsx reveals the wallet's private key on one
--      tap. Import it into MetaMask and the money leaves without the withdraw flow ever running.
--   2. Any direct call into the Openfort SDK from a tampered client.
--
-- The ONE thing the browser cannot do without us is mint an Openfort Shield encryption session
-- (openfort-shield-session holds the Shield secret + project encryption share). Every path to a
-- usable embedded signer — first mint, recovery after a page reload, a send, AND the private-key
-- export — needs that session. So the hold goes there, which covers both bypasses at once
-- instead of patching them one at a time.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- Two functions, two DELIBERATELY OPPOSITE unknown-country behaviours:
--
--   cashout_face_gate_required   (the withdraw step — authorises MOVING MONEY)
--       unknown country => GATED. A geo-lookup outage or a VPN must not be a way to skip the
--       check on the money-moving action. Fails CLOSED.
--
--   cashout_gate_holds_wallet    (the Shield mint — authorises USING THE WALLET AT ALL)
--       unknown country => NOT held. Holding here on an inconclusive geo lookup would brick
--       every embedded wallet during an ipwho.is outage, including repayments, and lock people
--       out of their own funds. Fails OPEN.
--
-- Note that at time of writing all 5 embedded-wallet holders have auth_ip_log.country_iso = NULL
-- (MaxMind enrichment never populated for them), so the live request-IP lookup that
-- openfort-shield-session / create-didit-session pass in is doing the real work; the DB column is
-- only a fallback.
-- ─────────────────────────────────────────────────────────────────────────────────────────

-- ---------------------------------------------------------------------------
-- 1. Admin escape hatch.
--
-- A hard hold on wallet usability NEEDS a manual release, or a borrower whose face check can
-- never pass (unusable KYC portrait, a BLOCKED verdict, a Didit outage) has their funds stranded
-- with no way out. Server-writable only — a client-writable exemption would be the whole gate.
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists cashout_gate_exempt boolean not null default false;

-- Re-declare the privileged-column guard to protect the new column.
--
-- Per the LESSON in 20260811020000: this function is edited from more than one place, so the
-- body below is the UNION of the LIVE deployed definition (read via pg_get_functiondef on
-- 2026-08-20, which matched 20260811020000 exactly — no drift) plus cashout_gate_exempt.
-- MUST stay SECURITY INVOKER: under SECURITY DEFINER current_user resolves to the owner and the
-- guard would silently never fire.
create or replace function enforce_user_privileged_columns_server_only()
returns trigger as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.is_world_id is distinct from old.is_world_id
     or new.is_didit is distinct from old.is_didit
     or new.liveness_status is distinct from old.liveness_status
     or new.liveness_session_id is distinct from old.liveness_session_id
     or new.nullifier_hash is distinct from old.nullifier_hash
     or new.cs is distinct from old.cs
     or new.mal is distinct from old.mal
     or new.nal is distinct from old.nal
     or new.credit_progression_paused is distinct from old.credit_progression_paused
     or new.current_risk_score is distinct from old.current_risk_score
     or new.current_risk_band is distinct from old.current_risk_band
     or new.risk_computed_at is distinct from old.risk_computed_at
     or new.account_status is distinct from old.account_status
     or new.is_veriff is distinct from old.is_veriff
     or new.didit_id_status is distinct from old.didit_id_status
     or new.wallet_face_status is distinct from old.wallet_face_status
     or new.wallet_face_session_id is distinct from old.wallet_face_session_id
     or new.wallet_face_checked_at is distinct from old.wallet_face_checked_at
     -- Cash-out gate exemption (20260820110000). Client-writable would mean self-release:
     -- set cashout_gate_exempt = true and the wallet hold evaporates with no face check.
     or new.cashout_gate_exempt is distinct from old.cashout_gate_exempt
  then
    raise exception 'users: verification/credit columns can only be written by verified server-side code';
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

drop trigger if exists trg_enforce_user_privileged_columns on users;
create trigger trg_enforce_user_privileged_columns
  before update on users
  for each row execute function enforce_user_privileged_columns_server_only();

-- ---------------------------------------------------------------------------
-- 2. Does the cash-out gate currently hold this account's embedded wallet?
--
-- Called by openfort-shield-session on EVERY mint (first creation, recovery, pre-send, export),
-- so it must be cheap and it must not hold anyone who has nothing at stake.
--
-- Scoped to a borrower who is actually FUNDED (a 'Lent' loan). Without that condition a brand-new
-- borrower who just minted their wallet would be held immediately — demanding a second face scan
-- seconds after the wallet-mint scan, before they have any money to protect. The hold exists for
-- the window between "your loan landed" and "you cashed it out", which is exactly the window the
-- incident happened in.
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
   -- No sponsored wallet yet => this is a first mint, governed by may_mint_embedded_wallet only.
   if not exists (select 1 from public.embedded_wallet_grants g where g.user_id = p_user_id) then
      return jsonb_build_object('held', false, 'reason', 'NOT_EMBEDDED_WALLET');
   end if;

   if coalesce((select u.cashout_gate_exempt from public.users u where u.id = p_user_id), false) then
      return jsonb_build_object('held', false, 'reason', 'EXEMPT');
   end if;

   -- Nothing disbursed to protect.
   if not exists (
      select 1 from public.loans l
      where l.borrower_user_id = p_user_id
        and l.loan_status = 'Lent'
   ) then
      return jsonb_build_object('held', false, 'reason', 'NOT_FUNDED');
   end if;

   -- Already cashed out once => out of scope for a FIRST-cash-out gate. This is also what
   -- releases the wallet for repayment later on.
   if exists (select 1 from public.withdrawals w where w.borrower_user_id = p_user_id) then
      return jsonb_build_object('held', false, 'reason', 'NOT_FIRST_CASHOUT');
   end if;

   -- Live request-IP country first, the account's most recent enriched login as fallback.
   -- Unknown FAILS OPEN here — see the header.
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

   -- A face check passed in the last 24h releases the wallet. Deliberately time-based rather
   -- than requiring an unconsumed approval: the per-transfer binding
   -- (cashout_face_gate_required) is what authorises a specific send, while THIS only answers
   -- "has this person proven their face recently". Without the window, a send that reverted
   -- on-chain (approval consumed, no withdrawals row) would re-brick the wallet instantly.
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

-- ---------------------------------------------------------------------------
-- 3. Tighten cashout_face_gate_required (from 20260820100000).
--
-- Two changes:
--   * unknown country now GATES instead of skipping. As originally written, a failed geo lookup
--     or a VPN meant the money-moving check silently did not run.
--   * added the same 'Lent' loan and exemption conditions, so the two functions agree on who is
--     in scope and an admin release covers both.
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

   -- An APPROVED, unspent, unexpired check bound to THIS destination + amount. Change either and
   -- the approval no longer applies, so one scan authorises one transfer.
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

   -- Country LAST, so the cheap out-of-scope exits above don't depend on it. Unknown FAILS
   -- CLOSED here (gated) — the opposite of cashout_gate_holds_wallet. See the header.
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
-- 4. Admin release. Admin-only (app_private.is_moodeng_admin), matching the pattern in
-- 20260629060000_admin_self_lending_tools. Writes through SECURITY DEFINER so the
-- privileged-column trigger's server-side branch applies.
-- ---------------------------------------------------------------------------
create or replace function public.set_cashout_gate_exempt(p_user_id uuid, p_exempt boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'set_cashout_gate_exempt: admin only';
  end if;

  update public.users set cashout_gate_exempt = coalesce(p_exempt, false) where id = p_user_id;
  return found;
end;
$$;

revoke all on function public.set_cashout_gate_exempt(uuid, boolean) from public;
revoke all on function public.set_cashout_gate_exempt(uuid, boolean) from anon;
grant execute on function public.set_cashout_gate_exempt(uuid, boolean) to authenticated, service_role, postgres;
