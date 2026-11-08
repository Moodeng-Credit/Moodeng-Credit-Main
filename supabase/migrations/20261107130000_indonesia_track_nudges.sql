-- Indonesia track: Telegram nudges for people who stall in onboarding (supabase/functions/_shared/
-- idTrack.ts runIdOnboardingNudges, run about once an hour from video-call-reminders).
--
--   id_nudge_count  how many "Tinggal X langkah lagi" nudges they've had (max 3)
--   id_nudged_at    when the last one went out (at most one per 24h)
--
-- Server-only, like the other ID-track columns: no client grant, and blanked on a client INSERT of the
-- profile row (app_private.reset_id_track_columns_on_insert, redefined here with the original columns).

alter table public.users add column if not exists id_nudge_count integer not null default 0;
alter table public.users add column if not exists id_nudged_at timestamptz;

comment on column public.users.id_nudge_count is 'Indonesia track: onboarding nudges sent on Telegram (max 3). Server-only.';
comment on column public.users.id_nudged_at is 'Indonesia track: when the last onboarding nudge was sent. Server-only.';

create index if not exists users_id_nudge_idx on public.users (created_at) where market = 'ID';

create or replace function app_private.reset_id_track_columns_on_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.market := null;
    new.market_set_at := null;
    new.facebook_profile_url := null;
    new.facebook_page_followed_at := null;
    new.walt_address := null;
    new.walt_address_set_at := null;
    new.id_nudge_count := 0;
    new.id_nudged_at := null;
  end if;
  return new;
end;
$$;
