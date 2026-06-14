-- Identity verification status via Didit (KYC: ID + liveness + face match).
-- Independent of World ID; either being 'ACTIVE' marks the user as identity-verified.
alter table users add column if not exists is_didit text not null default 'INACTIVE';
