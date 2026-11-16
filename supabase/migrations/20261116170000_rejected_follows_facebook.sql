-- Rejected follows the Facebook (George 2026-11-16, "she is cheating"): someone rejected on one
-- account made a new account with another Gmail and connected the same Facebook to start over.
-- When an account gets a messenger_psid (SendPulse contact = one Facebook) that a rejected account
-- already has, it's rejected too, with the same "for now" date (loan_access_retry_at; null = for good).
-- A trigger, so every linking path (code, tap timing, admin) is covered. Only accounts that aren't
-- approved or already decided; /reopen on one account doesn't reopen the others.

create or replace function public.reject_when_facebook_rejected()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  forever boolean;
  retry timestamptz;
begin
  if new.messenger_psid is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.messenger_psid is not distinct from old.messenger_psid then
    return new;
  end if;
  if coalesce(new.loan_access_status, 'none') not in ('none', 'pending') then
    return new;
  end if;

  select bool_or(u.loan_access_retry_at is null), max(u.loan_access_retry_at)
    into forever, retry
    from public.users u
   where u.messenger_psid = new.messenger_psid
     and u.id <> new.id
     and u.loan_access_status = 'rejected';

  if forever is null then
    return new; -- no rejected account on this Facebook
  end if;

  new.loan_access_status := 'rejected';
  new.loan_access_retry_at := case when forever then null else retry end;
  return new;
end;
$function$;

drop trigger if exists users_reject_when_facebook_rejected on public.users;
create trigger users_reject_when_facebook_rejected
  before insert or update of messenger_psid on public.users
  for each row execute function public.reject_when_facebook_rejected();
