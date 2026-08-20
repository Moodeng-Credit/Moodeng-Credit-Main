-- Face gate for the FIRST cash-out from an embedded (Instant) wallet, PH borrowers only.
--
-- Incident that motivated this: a borrower's partner learned she had just been funded, took
-- her unlocked phone, and cashed the loan out to his own Coins.ph account. Device, session and
-- wallet were all legitimate — nothing that checks "is this device/session okay" can ever catch
-- this, because it's the true device and the true session. The only thing that separates her
-- from him at that moment is her face.
--
-- The decision this gate makes is NOT "is a live human present" (passive liveness) — he is also
-- a live human, and he was holding her phone, which almost certainly has photos of her on it,
-- so a liveness-only gate would not have stopped him. The decision is a 1:1 FACE MATCH against
-- the portrait from the account's ORIGINAL KYC session. Passive liveness still runs, but only
-- as a guard on the input (rejects a printed photo / screen replay of her face), never as the
-- decision by itself. See supabase/functions/_shared/diditFaceSearch.ts (resolveCashoutFaceOutcome).
--
-- Scope (all four required, see cashout_face_gate_required):
--   1. Embedded (Openfort) wallet only — a row in embedded_wallet_grants. External wallets
--      (Base Account, MetaMask, Phantom) are out of scope: the holder can move funds from those
--      without touching Moodeng, so a gate there is theatre. Embedded wallets are the only ones
--      the platform can protect, and are the product reason to push borrowers onto them.
--   2. Philippines — where the incident occurred.
--   3. First cash-out ever (no prior public.withdrawals row) — the highest-risk moment, right
--      after a borrower's household learns she was funded.
--   4. Cash-out intent, not repayment — repayment sends money back to the lender and is never
--      gated by this.
--
-- Each approval is bound to the destination address + amount it was taken for (see
-- cashout_face_checks.destination_address/amount and consume_cashout_face_check) — change either
-- and the attestation is void, so this is a per-transaction authorisation, not a standing pass.

create table if not exists public.cashout_face_checks (
   id                   uuid primary key default gen_random_uuid(),
   user_id              uuid not null references public.users(id) on delete cascade,
   loan_id              uuid references public.loans(id) on delete set null,
   didit_session_id     text,
   status               text not null default 'PENDING',
      -- PENDING    scan started, awaiting Didit's verdict
      -- APPROVED   liveness clean + 1:1 match against the original KYC'er's face
      -- MISMATCH   liveness clean but the face does NOT match the account's KYC'er — the
      --            incident this gate exists to catch
      -- DECLINED   liveness itself failed (spoof, poor capture, abandoned/expired)
      -- BLOCKED    no usable KYC reference portrait to check against — never auto-approved;
      --            see the enrolment trap in the plan doc, this always needs manual review
      -- CONSUMED   an APPROVED check has been spent authorising the bound send
   liveness_score       numeric,
   match_score          numeric,
   matched_user_id      uuid references public.users(id),  -- 1:N search hit on MISMATCH, if any
   decline_reason       text,
   destination_address  text not null,
   amount               numeric not null,
   country_iso          text,
   created_at           timestamptz not null default now(),
   checked_at           timestamptz,
   expires_at           timestamptz,
   consumed_at          timestamptz
);

create index if not exists cashout_face_checks_user_idx on public.cashout_face_checks (user_id, created_at desc);
create unique index if not exists cashout_face_checks_session_idx on public.cashout_face_checks (didit_session_id) where didit_session_id is not null;

alter table public.cashout_face_checks enable row level security;

-- Owners may see their own attempts (the withdraw-flow UI polls status); admins see everyone's.
-- No client-facing insert/update/delete policy — every write is service-role only (the edge
-- functions), same reasoning as embedded_wallet_grants: a client-writable status column would
-- let anyone self-approve their own cash-out.
drop policy if exists "owners read own cashout face checks" on public.cashout_face_checks;
create policy "owners read own cashout face checks" on public.cashout_face_checks
   for select to authenticated
   using (user_id = auth.uid() or app_private.is_moodeng_admin());

revoke all on table public.cashout_face_checks from public;
revoke all on table public.cashout_face_checks from anon;
grant select on table public.cashout_face_checks to authenticated;
grant all on table public.cashout_face_checks to service_role;

-- ---------------------------------------------------------------------------
-- The authorisation check, called by create-didit-session (service-role only, before spending a
-- Didit credit) to decide whether this cash-out needs a scan at all. Not client-callable — the
-- withdraw-flow client only ever sees the yes/no answer via that function's response.
--
-- p_destination/p_amount bind "has a valid check" to the exact transfer it was taken for, so an
-- approval from one cash-out attempt can never authorise a different one.
-- p_country_iso is passed in from the caller's request IP (see check-geo's pattern); when null,
-- fails back to the account's most recent auth_ip_log country as a best-effort signal.
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
   has_grant     boolean;
   first_cashout boolean;
   country       text;
   has_valid     boolean;
begin
   select exists (select 1 from public.embedded_wallet_grants g where g.user_id = p_user_id) into has_grant;
   if not has_grant then
      return jsonb_build_object('required', false, 'reason', 'NOT_EMBEDDED_WALLET');
   end if;

   select not exists (select 1 from public.withdrawals w where w.borrower_user_id = p_user_id)
     into first_cashout;
   if not first_cashout then
      return jsonb_build_object('required', false, 'reason', 'NOT_FIRST_CASHOUT');
   end if;

   country := upper(coalesce(p_country_iso, ''));
   if country = '' then
      select a.country_iso into country
      from public.auth_ip_log a
      where a.user_id = p_user_id
        and a.country_iso is not null
      order by a.last_seen_at desc
      limit 1;
      country := upper(coalesce(country, ''));
   end if;

   if country is distinct from 'PH' then
      return jsonb_build_object('required', false, 'reason', 'NOT_PH');
   end if;

   select exists (
      select 1 from public.cashout_face_checks c
      where c.user_id = p_user_id
        and c.status = 'APPROVED'
        and c.consumed_at is null
        and c.expires_at > now()
        and c.destination_address = p_destination
        and c.amount = p_amount
   ) into has_valid;

   if has_valid then
      return jsonb_build_object('required', false, 'reason', 'HAS_VALID_CHECK');
   end if;

   return jsonb_build_object('required', true, 'reason', 'FACE_REQUIRED');
end;
$$;

-- ---------------------------------------------------------------------------
-- Spend an APPROVED check at the moment its bound send actually happens. Called by the
-- withdraw-flow client itself right after a successful send (see recordWithdrawal.ts), so a
-- single approval can't quietly outlive the transaction it was taken for. Deliberately callable
-- by `authenticated` — unlike the two functions above, this one takes NO caller-supplied user id
-- (uses auth.uid() internally), so a caller can only ever consume their OWN check; the
-- status/consumed_at/expiry/binding guards mean the worst a malicious call can do is a no-op.
-- Not itself a security boundary — cashout_face_gate_required's destination+amount binding
-- already means an unconsumed approval only ever re-authorises the SAME transfer, never a new
-- one. This just closes the window a spent approval would otherwise sit open in.
-- ---------------------------------------------------------------------------
create or replace function public.consume_cashout_face_check(
   p_check_id uuid,
   p_destination text,
   p_amount numeric
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
   claimed boolean := false;
begin
   -- SECURITY DEFINER (bypasses RLS, which grants `authenticated` select-only on this table) —
   -- safe because auth.uid() is read from the caller's own JWT regardless of definer, so this
   -- can only ever touch the calling user's own rows.
   update public.cashout_face_checks
      set consumed_at = now()
    where id = p_check_id
      and user_id = auth.uid()
      and destination_address = p_destination
      and amount = p_amount
      and status = 'APPROVED'
      and consumed_at is null
      and expires_at > now();

   claimed := found;
   return claimed;
end;
$$;

revoke all on function public.cashout_face_gate_required(uuid, text, numeric, text) from public;
revoke all on function public.cashout_face_gate_required(uuid, text, numeric, text) from anon;
revoke all on function public.cashout_face_gate_required(uuid, text, numeric, text) from authenticated;
grant execute on function public.cashout_face_gate_required(uuid, text, numeric, text) to service_role, postgres;

revoke all on function public.consume_cashout_face_check(uuid, text, numeric) from public;
revoke all on function public.consume_cashout_face_check(uuid, text, numeric) from anon;
grant execute on function public.consume_cashout_face_check(uuid, text, numeric) to authenticated, service_role, postgres;
