-- Narrow 20261121190000: only a number someone explicitly 🚫 Blocked for good follows to new accounts.
-- Any plain reject was too wide: in the live data one WhatsApp number is shared by a rejected account
-- and an approved borrower with 4 loans (one phone in a household). Under the old rule that borrower
-- would have been rejected on sign-up. Plain rejects stay with the team: the linked-accounts check
-- still flags them and blocks auto ✅.
--
-- users.blocked_for_good_at: set by the 🚫 Block for good button (blockForGood.ts) and by this
-- trigger; cleared by /unghost. A new account that verifies a WhatsApp number already verified on a
-- blocked-for-good account is rejected for good, ghosted and marked blocked too (quiet: nothing is
-- sent). The linked-accounts sweep tells the team once, with how to undo it.

alter table public.users add column if not exists blocked_for_good_at timestamptz;

comment on column public.users.blocked_for_good_at is
  '🚫 Block for good (team tap) or auto (same verified WhatsApp as a blocked account). New accounts verifying the same WhatsApp number are rejected + ghosted. Cleared by /unghost.';

create or replace function public.reject_when_whatsapp_rejected()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  digits text;
  blocked boolean;
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

  select true into blocked
    from public.users u
   where regexp_replace(u.whatsapp_number, '\D', '', 'g') = digits
     and u.whatsapp_verified_at is not null
     and u.id <> new.id
     and u.blocked_for_good_at is not null
   limit 1;

  if blocked is null then
    return new; -- nobody blocked for good on this number
  end if;

  new.loan_access_status := 'rejected';
  new.loan_access_retry_at := null;
  new.blocked_for_good_at := now();
  new.ghosted_at := now();
  new.ghosted_by := 'auto: same WhatsApp as a blocked account';
  return new;
end;
$function$;
