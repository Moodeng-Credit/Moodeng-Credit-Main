-- Refund reasons and off-platform settlement notes are internal (2026-10-02).
--
-- loans.refund_reason / offplatform_settlement_note sat on the loan row, which the borrower and lender
-- can read ("users read own loans"), and sellable loans are readable by anyone. So a borrower could read
-- the admin's reason (e.g. a fraud suspicion), and in platform-settlement mode, where the lender is told
-- it was an ordinary repayment, the lender could read the real reason. The ledger (loan_refunds.reason)
-- was also readable by the lender.
--
-- Now: both fields live in app_private.loan_private_notes (admins / server only). A trigger moves any
-- write of them there and leaves the loan columns empty, so admin-refund-loan and manual notes keep
-- working unchanged. The lender read policy on loan_refunds goes (nothing in the app uses it); admins
-- still manage the ledger.

create table if not exists app_private.loan_private_notes (
  loan_id uuid primary key,
  refund_reason text,
  offplatform_settlement_note text,
  updated_at timestamptz not null default now()
);

revoke all on app_private.loan_private_notes from public, anon, authenticated;

create or replace function app_private.divert_loan_private_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.refund_reason is not null or new.offplatform_settlement_note is not null then
    insert into app_private.loan_private_notes as n (loan_id, refund_reason, offplatform_settlement_note, updated_at)
    values (new.id, new.refund_reason, new.offplatform_settlement_note, now())
    on conflict (loan_id) do update
      set refund_reason = coalesce(excluded.refund_reason, n.refund_reason),
          offplatform_settlement_note = coalesce(excluded.offplatform_settlement_note, n.offplatform_settlement_note),
          updated_at = now();
    new.refund_reason := null;
    new.offplatform_settlement_note := null;
  end if;
  return new;
end;
$$;

-- "zz_" so it runs after the other BEFORE triggers (the refund-column guard still sees the client's
-- attempted write and rejects it first).
drop trigger if exists zz_divert_loan_private_notes on public.loans;
create trigger zz_divert_loan_private_notes
  before insert or update on public.loans
  for each row execute function app_private.divert_loan_private_notes();

-- Move what's already there (without bumping updated_at: some old loans' on-time rule falls back to it).
insert into app_private.loan_private_notes (loan_id, refund_reason, offplatform_settlement_note)
select id, refund_reason, offplatform_settlement_note
  from public.loans
 where refund_reason is not null or offplatform_settlement_note is not null
on conflict (loan_id) do update
  set refund_reason = coalesce(excluded.refund_reason, app_private.loan_private_notes.refund_reason),
      offplatform_settlement_note = coalesce(excluded.offplatform_settlement_note, app_private.loan_private_notes.offplatform_settlement_note);

alter table public.loans disable trigger update_loans_updated_at;
update public.loans
   set refund_reason = null, offplatform_settlement_note = null
 where refund_reason is not null or offplatform_settlement_note is not null;
alter table public.loans enable trigger update_loans_updated_at;

-- Ledger: admins only.
drop policy if exists "lenders read own refunds" on public.loan_refunds;
