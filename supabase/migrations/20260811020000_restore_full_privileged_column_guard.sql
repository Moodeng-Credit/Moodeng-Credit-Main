-- Restore the FULL privileged-column guard on public.users.
--
-- 20260811000000 rebuilt enforce_user_privileged_columns_server_only() to add the three
-- wallet_face_* columns, copying the column list from the 20260710010000 migration file. But
-- the file was stale: the function actually deployed had since gained two more columns that
-- were never written back into a migration —
--
--     is_veriff          (Veriff verification status)
--     didit_id_status    (raw Didit ID-workflow status)
--
-- so replacing the function from the file alone would have silently REMOVED their protection.
-- The "Users can update own data" policy has no column restriction, so an unguarded
-- didit_id_status means a signed-in user can write their own verification state — the exact
-- exploit class 20260710010000 exists to prevent.
--
-- This migration re-declares the guard with the UNION of every column that has ever been
-- protected. Verified against pg_get_functiondef on the live database before writing.
--
-- LESSON: this function is edited from more than one place. Always read the deployed body
-- (select pg_get_functiondef(oid) ... where proname = 'enforce_user_privileged_columns_server_only')
-- before replacing it, rather than trusting the newest migration file to be complete.
--
-- MUST stay SECURITY INVOKER: inside a SECURITY DEFINER function current_user resolves to the
-- owner, so the guard would never fire and this would silently protect nothing.

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
     -- Restored: present on the deployed function, absent from every migration file.
     or new.is_veriff is distinct from old.is_veriff
     or new.didit_id_status is distinct from old.didit_id_status
     -- Embedded-wallet face gate (20260811000000). Client-writable would mean self-approval:
     -- set wallet_face_status = 'APPROVED' and mint a sponsored wallet with no camera.
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
