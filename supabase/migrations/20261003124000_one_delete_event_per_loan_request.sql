-- One delete event per removed loan request.
--
-- trg_record_loan_request_delete_event logs every deleted Requested loan, but admin-loan-request-removed
-- and admin-ban-user ALSO inserted an event before deleting, so an admin removal logged two rows.
-- get_loan_request_repost_status counts the last 24h of rows and blocks reposting at 2, so one admin
-- removal put the borrower straight into the 30-minute repost cooldown.
--
-- Fix at the source of truth: a loan can only be deleted once, so there is one event per loan. The unique
-- index enforces it and the trigger tolerates an event that was already inserted, which also makes the
-- currently-deployed admin functions log exactly one row.

-- Drop the existing duplicates (3 old removals), keeping one row per loan.
delete from public.loan_request_delete_events e
 using public.loan_request_delete_events d
 where e.loan_id = d.loan_id
   and e.id > d.id;

create unique index if not exists loan_request_delete_events_loan_id_key
  on public.loan_request_delete_events (loan_id);

create or replace function public.record_loan_request_delete_event()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if old.loan_status = 'Requested' and old.borrower_user_id is not null then
    insert into public.loan_request_delete_events (loan_id, borrower_user_id, deleted_at)
    values (old.id, old.borrower_user_id, now())
    on conflict (loan_id) do nothing;
  end if;

  return old;
end;
$function$;
