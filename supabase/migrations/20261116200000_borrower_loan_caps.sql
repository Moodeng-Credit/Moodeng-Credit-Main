-- Per-borrower loan cap, set by the team after a call ("keep her capped").
--
-- A borrower's normal limit (users.cs) still levels up as usual. The cap is a separate ceiling: a new
-- request that would take what they have in use (live requests + funded-not-repaid) past the cap is
-- held off the public board (on_hold_reason = 'over_cap') and the team is alerted
-- (loan-request-telegram-notification). Funding admins still see it on the board; the Fund button asks
-- for "Override" + a written reason first (admin-fund-loan action cap_override), which is saved in
-- loan_cap_overrides, posted to the team, and releases the hold.
--
-- Both tables are admin-only: requested loans are publicly readable, and neither the cap nor the
-- reason (often personal) may show to lenders.

create table if not exists public.borrower_loan_caps (
   user_id uuid primary key references public.users(id) on delete cascade,
   cap_usd numeric not null check (cap_usd > 0),
   note text,
   set_by uuid default auth.uid(),
   set_at timestamptz not null default now()
);

create table if not exists public.loan_cap_overrides (
   loan_id uuid primary key references public.loans(id) on delete cascade,
   reason text not null check (length(btrim(reason)) >= 10),
   cap_usd numeric,
   amount_usd numeric,
   in_use_usd numeric,
   overridden_by uuid,
   overridden_at timestamptz not null default now()
);

alter table public.borrower_loan_caps enable row level security;
alter table public.loan_cap_overrides enable row level security;
revoke all on public.borrower_loan_caps from anon;
revoke all on public.loan_cap_overrides from anon;
drop policy if exists borrower_loan_caps_admin_all on public.borrower_loan_caps;
create policy borrower_loan_caps_admin_all on public.borrower_loan_caps for all to authenticated
   using (app_private.is_moodeng_admin()) with check (app_private.is_moodeng_admin());
drop policy if exists loan_cap_overrides_admin_read on public.loan_cap_overrides;
create policy loan_cap_overrides_admin_read on public.loan_cap_overrides for select to authenticated
   using (app_private.is_moodeng_admin());

-- What the borrower has in use, excluding one loan: live requests (< 7 days) + funded, not fully repaid.
-- Same rule as enforce_borrower_credit_limits.
create or replace function app_private.borrower_cap_in_use(p_user_id uuid, p_exclude_loan uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
   select coalesce(sum(l.loan_amount), 0)
     from public.loans l
    where l.borrower_user_id = p_user_id
      and l.id is distinct from p_exclude_loan
      and (
         (l.loan_status = 'Requested'::loan_status and l.created_at > now() - interval '7 days')
         or (l.loan_status = 'Lent'::loan_status and l.repayment_status is distinct from 'Paid'::repayment_status)
      );
$$;
revoke all on function app_private.borrower_cap_in_use(uuid, uuid) from public, anon, authenticated;

-- Before insert, named to run after trg_hold_request_until_first_call so it has the last word on the
-- hold reason ("Showed up" releases a call hold; an over-cap request must stay held).
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
   select c.cap_usd into v_cap from public.borrower_loan_caps c where c.user_id = new.borrower_user_id;
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

drop trigger if exists zz_hold_request_over_cap on public.loans;
create trigger zz_hold_request_over_cap
   before insert on public.loans
   for each row execute function app_private.hold_request_over_cap();
