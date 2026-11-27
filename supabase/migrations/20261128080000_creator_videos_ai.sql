-- moodeng.app/creator v2 (Emma 2026-11-27): a short "why I want to work with Moodeng" video + an AI read.
-- The page uploads the clip to the private creator-videos bucket under <application id>/ right after the
-- form is saved (before the email code), then attaches it. After the code, referral-payout-telegram-notification
-- grades it (Gemini watches the video, Apify reads TikTok reach) and posts the team card with the score.
-- The AI only advises: the team still taps Approve / Reject.

alter table public.creator_applications
  add column if not exists video_path text,
  add column if not exists ai jsonb,
  add column if not exists ai_score int,
  add column if not exists ai_verdict text,
  add column if not exists graded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-videos', 'creator-videos', false, 45 * 1024 * 1024,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v', 'video/mpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Upload allowed only into the folder of a fresh application that has no clip yet.
create or replace function app_private.creator_video_open(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.creator_applications a
     where a.id::text = p_folder
       and a.status in ('unverified', 'pending')
       and a.video_path is null
       and a.created_at > now() - interval '1 day'
  ) and (
    select count(*) from storage.objects o where o.bucket_id = 'creator-videos' and o.name like p_folder || '/%'
  ) < 2
$$;
revoke all on function app_private.creator_video_open(text) from public;
grant execute on function app_private.creator_video_open(text) to anon, authenticated;

drop policy if exists "creator videos: applicants upload" on storage.objects;
create policy "creator videos: applicants upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'creator-videos' and app_private.creator_video_open((storage.foldername(name))[1]));

drop policy if exists "creator videos: admins read" on storage.objects;
create policy "creator videos: admins read" on storage.objects
  for select to authenticated
  using (bucket_id = 'creator-videos' and app_private.is_moodeng_admin());

-- The page tells us which file is the clip (it must already be in that application's folder).
create or replace function public.creator_apply_attach_video(p_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_path is null or p_path not like p_id::text || '/%'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'creator-videos' and o.name = p_path) then
    raise exception 'creator_video_missing';
  end if;
  update public.creator_applications
     set video_path = p_path
   where id = p_id and status in ('unverified', 'pending') and video_path is null;
end;
$$;
revoke all on function public.creator_apply_attach_video(uuid, text) from public;
grant execute on function public.creator_apply_attach_video(uuid, text) to anon, authenticated;

-- Apify token for the TikTok reach check (service_role only, like gemini_api_key()).
create or replace function public.apify_token()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'APIFY_TOKEN' limit 1;
$$;
revoke all on function public.apify_token() from public, anon, authenticated;
grant execute on function public.apify_token() to service_role;

-- Grading takes up to ~2 minutes: give the call room (it replies at once and grades in the background).
create or replace function private.creator_app_notify(p_body jsonb)
returns void
language plpgsql
security definer
set search_path = 'public', 'vault', 'net'
as $$
declare
  project_url text;
  service_key text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1;
  select decrypted_secret into service_key from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1;
  if project_url is null or service_key is null then
    raise warning 'Creator application notification skipped: project URL or secret key missing from vault.';
    return;
  end if;
  perform net.http_post(
    url := project_url || '/functions/v1/referral-payout-telegram-notification',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_key),
    body := jsonb_build_object('creatorApp', p_body),
    timeout_milliseconds := 30000
  );
end;
$$;
revoke all on function private.creator_app_notify(jsonb) from public, anon, authenticated;

-- Admin: run the AI again (e.g. after it failed). No team card, no email.
create or replace function public.admin_regrade_creator_application(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admin only';
  end if;
  if not exists (select 1 from public.creator_applications where id = p_id and status <> 'unverified') then
    raise exception 'application not found';
  end if;
  update public.creator_applications set ai = null, ai_score = null, ai_verdict = null, graded_at = null where id = p_id;
  perform private.creator_app_notify(jsonb_build_object('event', 'grade', 'id', p_id));
end;
$$;
revoke all on function public.admin_regrade_creator_application(uuid) from public, anon;
grant execute on function public.admin_regrade_creator_application(uuid) to authenticated;

-- Admin list: best AI score first among the new ones.
create or replace function public.admin_creator_applications()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not app_private.is_moodeng_admin() then
    raise exception 'admin only';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(a) - 'code_hash' - 'code_expires_at' - 'code_attempts' - 'code_sends' - 'last_code_at'
                     order by (a.status = 'pending') desc, a.ai_score desc nulls first, a.verified_at desc)
      from public.creator_applications a
     where a.status <> 'unverified'
       and (a.status = 'pending' or a.verified_at > now() - interval '120 days')
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_creator_applications() from public, anon;
grant execute on function public.admin_creator_applications() to authenticated;
