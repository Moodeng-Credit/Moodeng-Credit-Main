-- Only a borrower deleting their own request counts toward the repost cooldown
-- (2 deletes in 24h → 30 min pause). Admin removals (service role or admin JWT) used to be
-- recorded too, so a borrower whose requests we removed was then blocked from re-applying.
create or replace function public.record_loan_request_delete_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.loan_status = 'Requested'
     and old.borrower_user_id is not null
     and auth.uid() is not distinct from old.borrower_user_id then
    insert into public.loan_request_delete_events (loan_id, borrower_user_id, deleted_at)
    values (old.id, old.borrower_user_id, now())
    on conflict (loan_id) do nothing;
  end if;

  return old;
end;
$function$;
