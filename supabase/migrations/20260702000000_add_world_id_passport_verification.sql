-- Track World ID Passport/ID verification separately from the Orb (Proof of Human)
-- verification. The existing is_world_id / nullifier_hash columns continue to hold the
-- Orb verification untouched. These new columns hold the Passport verification so the
-- two methods are fully independent: a user can be verified by Orb, by Passport, or both,
-- and each can be queried separately.
--
-- World ID nullifiers are scoped per credential, so the Orb and Passport nullifiers are
-- different values; keeping them in separate UNIQUE columns preserves correct
-- "already used by another account" deduplication for each method.
alter table public.users
  add column if not exists is_world_id_passport world_id_status default 'INACTIVE';

alter table public.users
  add column if not exists nullifier_hash_passport text;

-- Enforce one passport identity per account (mirrors the nullifier_hash UNIQUE constraint).
-- NULLs are allowed for users who have not completed passport verification.
create unique index if not exists users_nullifier_hash_passport_key
  on public.users (nullifier_hash_passport);
