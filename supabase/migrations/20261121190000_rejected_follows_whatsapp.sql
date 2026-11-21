-- Rejected follows the WhatsApp number (George 2026-11-21, "perma block"): a borrower rejected on 3
-- accounts made a 4th with a new Gmail AND a new Facebook, so reject_when_facebook_rejected
-- (20261116170000) didn't catch it, but every account had the same verified WhatsApp number.
-- When an account verifies a WhatsApp number that a rejected account already verified, it's
-- rejected too, with the same "for now" date (null = for good). If any of those accounts was
-- ghosted (🚫 Block for good / /ghost), the new one is marked ghosted too (quiet: nothing is sent).
-- Numbers are compared on their digits. Only accounts that aren't approved or already decided;
-- /reopen on one account doesn't reopen the others.

create or replace function public.reject_when_whatsapp_rejected()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  digits text;
  forever boolean;
  retry timestamptz;
  ghost timestamptz;
begin
  if new.whatsapp_number is null or new.whatsapp_verified_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.whatsapp_number is not distinct from old.whatsapp_number
     and old.whatsapp_verified_at is not null then
    return new;
  end if;
  if coalesce(new.loan_access_status, 'none') not in ('none', 'pending') then
    return new;
  end if;
  digits := regexp_replace(new.whatsapp_number, '\D', '', 'g');
  if length(digits) < 8 then
    return new;
  end if;

  select bool_or(u.loan_access_retry_at is null), max(u.loan_access_retry_at), max(u.ghosted_at)
    into forever, retry, ghost
    from public.users u
   where regexp_replace(u.whatsapp_number, '\D', '', 'g') = digits
     and u.whatsapp_verified_at is not null
     and u.id <> new.id
     and u.loan_access_status = 'rejected';

  if forever is null then
    return new; -- no rejected account on this number
  end if;

  new.loan_access_status := 'rejected';
  new.loan_access_retry_at := case when forever then null else retry end;
  if ghost is not null then
    new.ghosted_at := now();
    new.ghosted_by := 'auto: same WhatsApp as a ghosted account';
  end if;
  return new;
end;
$function$;

drop trigger if exists users_reject_when_whatsapp_rejected on public.users;
create trigger users_reject_when_whatsapp_rejected
  before insert or update of whatsapp_number, whatsapp_verified_at on public.users
  for each row execute function public.reject_when_whatsapp_rejected();
