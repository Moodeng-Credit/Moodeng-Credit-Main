-- Soft loan caps: the team is told, the borrower is not.
--
-- A hard cap (soft = false, the default) holds an over-cap request off the board and the borrower sees
-- "Our team is checking this amount". A soft cap holds nothing: the request goes to lenders as normal,
-- the borrower sees no change, and the team alert (loan-request-telegram-notification) says it is over
-- their soft cap. The Fund modal shows a warning but no Override step.

alter table public.borrower_loan_caps add column if not exists soft boolean not null default false;

create or replace function app_private.hold_request_over_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
   v_cap numeric;
begin
   if new.loan_status <> 'Requested' or new.borrower_user_id is null then
      return new;
   end if;
   -- Soft caps never hold: they only change what the team is told.
   select c.cap_usd into v_cap from public.borrower_loan_caps c where c.user_id = new.borrower_user_id and not c.soft;
   if v_cap is null then
      return new;
   end if;
   if app_private.borrower_cap_in_use(new.borrower_user_id, new.id) + coalesce(new.loan_amount, 0) > v_cap then
      new.on_hold_since := now();
      new.on_hold_reason := 'over_cap';
   end if;
   return new;
end;
$$;
