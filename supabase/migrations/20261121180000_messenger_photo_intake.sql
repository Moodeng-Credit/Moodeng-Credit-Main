-- Photos sent in the Messenger chat as proof of income (George, 2026-11-21: "if they can't upload ... send it
-- via Messenger ... can our system pick it up automatically and update the cards").
--
-- Messenger's in-app browser on Android often can't open the photo picker. Borrowers can send the photos in
-- our Messenger chat instead; sendpulse-events (messengerPhotoIntake.ts) turns them into an income document
-- with the usual checks. Only when we are expecting proof from them, so selfies/memes stay support tickets:
-- they skipped proof in pre-screening, typed DOCS, or tapped "Send it in Messenger" (this marker).

alter table public.users add column if not exists messenger_photo_intake_until timestamptz;

-- Signed in: "I'll send it in Messenger" → expect their photos for the next 2 days.
create or replace function public.request_messenger_photo_intake()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  until timestamptz := now() + interval '2 days';
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.users set messenger_photo_intake_until = until where id = auth.uid();
  return until;
end;
$$;
revoke all on function public.request_messenger_photo_intake() from public, anon;
grant execute on function public.request_messenger_photo_intake() to authenticated;
