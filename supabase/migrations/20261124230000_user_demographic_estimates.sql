-- Estimated age + gender per user from a photo/clip we already hold (Gemini), for Growth / audience
-- analytics ONLY. Never read by scoring, approval, loan caps or any borrower-facing code.
-- Exact sources win: Didit ID read (kyc_identities.gender / date_of_birth) and the self-reported
-- "About you" card (users.about_gender / about_age, #1778). This table never overwrites either.
create table if not exists public.user_demographic_estimates (
  user_id uuid primary key references public.users (id) on delete cascade,
  face_visible boolean not null,
  est_gender text check (est_gender in ('female', 'male', 'unclear')),
  est_age_low smallint,
  est_age_high smallint,
  confidence numeric(3, 2),
  source_photo text not null, -- e.g. 'prescreen_intro_video', 'avatar', 'didit_selfie'
  source_ref text,            -- storage path / Didit session id (no names)
  model text not null,
  created_at timestamptz not null default now()
);

comment on table public.user_demographic_estimates is
  'AI-estimated apparent gender/age from one photo, analytics only. Never use for grading, approval or loan caps.';

alter table public.user_demographic_estimates enable row level security;

drop policy if exists user_demographic_estimates_admin_read on public.user_demographic_estimates;
create policy user_demographic_estimates_admin_read on public.user_demographic_estimates
  for select to authenticated using (app_private.is_moodeng_admin());

revoke all on public.user_demographic_estimates from anon;
revoke insert, update, delete on public.user_demographic_estimates from authenticated;
