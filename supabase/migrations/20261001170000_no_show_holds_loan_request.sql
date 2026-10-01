-- A video-call no-show puts the borrower's open loan request ON HOLD; booking a new call (or being
-- marked "Showed up") puts it back.
--
-- A borrower who misses their call shouldn't stay fundable on the request board, but deleting the
-- request loses it and starts the re-post cooldown. On hold it is hidden from lenders (the board
-- filters it), the funding flow refuses it before any money moves, and it reappears unchanged when
-- they rebook. Both directions run off the users.video_call_* columns every path already writes
-- (the ❌/✅ buttons, /noshow, the automatic Zoom no-show, Cal.com bookings), so nothing can miss it.

alter table public.loans add column if not exists on_hold_since timestamptz;
alter table public.loans add column if not exists on_hold_reason text;
comment on column public.loans.on_hold_since is
   'Set while an open request is parked (hidden from lenders, not fundable). Server-only.';
comment on column public.loans.on_hold_reason is
   'Why the request is on hold: ''no_show'' (missed video call; cleared when they book a new call or are marked showed up).';

create or replace function app_private.hold_requests_on_call_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.video_call_outcome = 'no_show' and old.video_call_outcome is distinct from 'no_show' then
    update public.loans
       set on_hold_since = now(), on_hold_reason = 'no_show'
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_since is null;
  elsif (new.video_call_outcome = 'attended' and old.video_call_outcome is distinct from 'attended')
     or (new.video_call_starts_at is not null
         and new.video_call_starts_at is distinct from old.video_call_starts_at
         and new.video_call_starts_at > now()) then
    update public.loans
       set on_hold_since = null, on_hold_reason = null
     where borrower_user_id = new.id
       and loan_status = 'Requested'
       and on_hold_reason = 'no_show';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hold_requests_on_call_change on public.users;
create trigger trg_hold_requests_on_call_change
  after update of video_call_outcome, video_call_starts_at on public.users
  for each row execute function app_private.hold_requests_on_call_change();

-- Borrowers can't take their own request off hold.
create or replace function app_private.keep_loan_hold()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.on_hold_since := old.on_hold_since;
    new.on_hold_reason := old.on_hold_reason;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_keep_loan_hold on public.loans;
create trigger trg_keep_loan_hold
  before update on public.loans
  for each row execute function app_private.keep_loan_hold();
