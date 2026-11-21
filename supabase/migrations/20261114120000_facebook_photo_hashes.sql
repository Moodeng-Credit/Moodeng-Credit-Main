-- Facebook profile check (supabase/functions/_shared/facebookProfileCheck.ts).
-- One SHA-256 per borrower of their Facebook profile picture. The grey default picture is the same
-- image for everyone, so a hash that another account also has = no real photo. Written by edge
-- functions only; admins can read.

create table if not exists public.facebook_photo_hashes (
  user_id uuid primary key references public.users(id) on delete cascade,
  hash text not null,
  bytes integer null,
  checked_at timestamptz not null default now()
);

create index if not exists facebook_photo_hashes_hash_idx on public.facebook_photo_hashes (hash);

alter table public.facebook_photo_hashes enable row level security;
revoke all on public.facebook_photo_hashes from anon, authenticated;
grant select on public.facebook_photo_hashes to authenticated;

drop policy if exists facebook_photo_hashes_admin_select on public.facebook_photo_hashes;
create policy facebook_photo_hashes_admin_select on public.facebook_photo_hashes
  for select to authenticated
  using (app_private.is_moodeng_admin());
