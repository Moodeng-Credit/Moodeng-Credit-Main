-- Face gate for embedded (Instant) wallet creation.
--
-- Why this exists: every embedded wallet is a sponsored smart account — Moodeng's paymaster
-- policy pays its gas (see VITE_OPENFORT_POLICY_ID / feeSponsorship). Wallets are therefore a
-- real, recurring cost, and nothing stopped one person opening thirty accounts and minting
-- thirty sponsored wallets. A liveness + 1:N face scan at mint time turns "one wallet per
-- account" into "one wallet per person", which is the property we actually need.
--
-- Deliberately separate from users.liveness_status (20260614000000). That column is the KYC
-- pre-gate for World ID / Didit and is reset on every KYC attempt; sharing it would mean a
-- wallet scan silently clobbering a verification in progress, and vice versa.
--
-- Scope: this gate fires ONLY when minting an embedded wallet. Connecting an external wallet
-- (Base Account, MetaMask, Phantom, WalletConnect) is untouched — no camera, no scan.

-- ---------------------------------------------------------------------------
-- 1. Per-attempt face-scan state
--
--   wallet_face_status:
--     'PENDING'   scan started, awaiting Didit's verdict
--     'APPROVED'  clean scan, may mint
--     'DUPLICATE' face already enrolled under a DIFFERENT account — refuse
--     'MISMATCH'  KYC'd borrower whose face did not match their own KYC enrollment — refuse
--     'DECLINED'  liveness itself failed (spoof, poor capture, abandoned)
--     'CONSUMED'  approval already spent on a mint; cannot be replayed
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists wallet_face_status text;
alter table public.users add column if not exists wallet_face_session_id text;
alter table public.users add column if not exists wallet_face_checked_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. The grant ledger — one embedded wallet per account, and the audit trail for cost.
--
-- A row here means "this account has been issued a sponsored embedded wallet". Its presence
-- is also what lets an EXISTING wallet keep working: provisioning is idempotent and the
-- Openfort SDK re-mints a Shield session on every recovery (after a page reload, before a
-- send), so the gate must let a granted user through without re-scanning. Only the first
-- mint costs a face scan.
--
-- wallet_address is nullable because the address is only known client-side once Openfort
-- returns the smart account; the trigger below fills it in from the wallet lock.
-- ---------------------------------------------------------------------------
create table if not exists public.embedded_wallet_grants (
   user_id         uuid primary key references public.users(id) on delete cascade,
   wallet_address  text,
   user_role       text,
   face_session_id text,
   granted_at      timestamptz not null default now()
);

create index if not exists embedded_wallet_grants_address_idx
   on public.embedded_wallet_grants (wallet_address);

alter table public.embedded_wallet_grants enable row level security;

-- Owners may see their own grant (the wallet UI reads it); only admins see everyone's.
drop policy if exists "owners read own embedded wallet grant" on public.embedded_wallet_grants;
create policy "owners read own embedded wallet grant" on public.embedded_wallet_grants
   for select to authenticated
   using (user_id = auth.uid() or app_private.is_moodeng_admin());

revoke all on table public.embedded_wallet_grants from public;
revoke all on table public.embedded_wallet_grants from anon;
grant select on table public.embedded_wallet_grants to authenticated;
grant all on table public.embedded_wallet_grants to service_role;

-- Fill in the address once the wallet lock lands on users.wallet_address.
create or replace function app_private.fill_embedded_wallet_grant_address()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
   if new.wallet_provider is distinct from 'openfort' then
      return new;
   end if;
   if new.wallet_address is null or btrim(new.wallet_address) = '' then
      return new;
   end if;

   update public.embedded_wallet_grants
      set wallet_address = lower(btrim(new.wallet_address)),
          user_role      = coalesce(user_role, new.user_role::text)
    where user_id = new.id
      and wallet_address is distinct from lower(btrim(new.wallet_address));

   return new;
end;
$$;

drop trigger if exists fill_embedded_wallet_grant_address_on_users on public.users;
create trigger fill_embedded_wallet_grant_address_on_users
   after insert or update of wallet_address on public.users
   for each row execute function app_private.fill_embedded_wallet_grant_address();

-- ---------------------------------------------------------------------------
-- 3. Grandfather every wallet that already exists.
--
-- Without this, shipping the gate would lock every current instant-wallet borrower out of
-- their own money: recovery needs a Shield session, the gate would demand a face scan they
-- never had to take, and their wallet would go dead. Grant first, gate second.
-- ---------------------------------------------------------------------------
insert into public.embedded_wallet_grants (user_id, wallet_address, user_role, granted_at)
select u.id,
       lower(btrim(u.wallet_address)),
       u.user_role::text,
       coalesce(u.wallet_connected_at, u.updated_at, u.created_at, now())
from public.users u
where u.wallet_provider = 'openfort'
  and u.wallet_address is not null
  and btrim(u.wallet_address) <> ''
on conflict (user_id) do nothing;

-- Also grandfather anyone who held an embedded wallet historically and has since moved to a
-- different wallet — they can still recover the old one, and must not be re-gated for it.
insert into public.embedded_wallet_grants (user_id, wallet_address, user_role, granted_at)
select distinct on (e.user_id)
       e.user_id,
       lower(btrim(e.wallet_address)),
       u.user_role::text,
       e.occurred_at
from public.wallet_connection_events e
join public.users u on u.id = e.user_id
where e.wallet_provider = 'openfort'
order by e.user_id, e.occurred_at asc
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. The authorization check, called by the openfort-shield-session edge function.
--
-- Returns { allowed, reason, already_granted }. Deliberately a function rather than
-- inline queries in the edge function so the rule lives in one place and can't drift
-- between the mint path and anything we add later.
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

   -- Recovery of an already-granted wallet is always allowed. This is the path every
   -- existing borrower hits on page reload and before every send.
   if has_grant then
      return jsonb_build_object('allowed', true, 'reason', 'ALREADY_GRANTED', 'already_granted', true);
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

-- ---------------------------------------------------------------------------
-- 5. Claim the grant. Called by the edge function immediately before it mints, so an
-- approval can only ever be spent once even if two taps race.
-- ---------------------------------------------------------------------------
create or replace function public.claim_embedded_wallet_grant(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
   claimed boolean := false;
begin
   -- Spend the approval atomically: only the transaction that flips APPROVED -> CONSUMED
   -- gets to insert the grant.
   update public.users
      set wallet_face_status = 'CONSUMED'
    where id = p_user_id
      and wallet_face_status = 'APPROVED';

   if not found then
      return false;
   end if;

   insert into public.embedded_wallet_grants (user_id, user_role, face_session_id, wallet_address)
   select p_user_id, u.user_role::text, u.wallet_face_session_id, lower(btrim(nullif(u.wallet_address, '')))
   from public.users u
   where u.id = p_user_id
   on conflict (user_id) do nothing;

   claimed := true;
   return claimed;
end;
$$;

-- Both live in `public` because the edge function reaches them through PostgREST's rpc()
-- (which only exposes `public`), but execute is revoked from every client-facing role — the
-- service-role key alone can call them. A user who could call claim_embedded_wallet_grant
-- directly would be able to grant themselves a wallet without a scan.
revoke all on function public.may_mint_embedded_wallet(uuid) from public;
revoke all on function public.may_mint_embedded_wallet(uuid) from anon;
revoke all on function public.may_mint_embedded_wallet(uuid) from authenticated;
revoke all on function public.claim_embedded_wallet_grant(uuid) from public;
revoke all on function public.claim_embedded_wallet_grant(uuid) from anon;
revoke all on function public.claim_embedded_wallet_grant(uuid) from authenticated;
grant execute on function public.may_mint_embedded_wallet(uuid) to service_role, postgres;
grant execute on function public.claim_embedded_wallet_grant(uuid) to service_role, postgres;

-- ---------------------------------------------------------------------------
-- 6. Make the new columns server-writable only.
--
-- Extends the guard from 20260710010000. Without this the whole gate is theatre: the
-- "Users can update own data" policy has no column restriction, so a signed-in user could
-- simply set their own wallet_face_status = 'APPROVED' and mint a sponsored wallet without
-- ever opening the camera. Same exploit class as self-setting is_world_id.
--
-- The function body below is the 20260710010000 original plus the three wallet_face_*
-- columns — keep it in sync if that list changes. It MUST stay SECURITY INVOKER: inside a
-- SECURITY DEFINER function current_user resolves to the owner, so the guard would never fire.
-- ---------------------------------------------------------------------------
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
     -- Embedded-wallet face gate (20260811000000). Client-writable would mean self-approval.
     or new.wallet_face_status is distinct from old.wallet_face_status
     or new.wallet_face_session_id is distinct from old.wallet_face_session_id
     or new.wallet_face_checked_at is distinct from old.wallet_face_checked_at
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
