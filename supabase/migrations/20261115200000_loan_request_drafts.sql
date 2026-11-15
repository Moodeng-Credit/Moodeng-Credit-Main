-- Loan requests a borrower started but never sent (2026-11-15).
--
-- Until now an unsent request lived only in the borrower's browser (localStorage, see
-- src/lib/loanRequestDraft.ts), so the team couldn't see what someone had asked for when they
-- stopped half-way (e.g. at proof of income). The request board now mirrors what they typed and the
-- screen they're on into one row per borrower, a few seconds after each change, and right away when
-- they leave for /documents or the ID check. Admin → Requests → "Started, not sent" lists them.
--
-- Borrowers write only through save_loan_request_draft() (auth.uid(), server time). A new loan from
-- that borrower marks the row sent (trigger on loans), so the list never shows someone who already
-- sent, even if the browser's own write fails. Closing the form does NOT remove the row: an
-- abandoned request is exactly what the team wants to see.

create table if not exists public.loan_request_drafts (
  user_id uuid primary key references public.users(id) on delete cascade,
  amount numeric check (amount is null or (amount >= 0 and amount < 1000000)),
  repay numeric check (repay is null or (repay >= 0 and repay < 1000000)),
  reason text check (reason is null or char_length(reason) <= 2000),
  due_date text check (due_date is null or char_length(due_date) <= 40),  -- as typed (yyyy-mm-dd)
  stopped_at text check (stopped_at is null or char_length(stopped_at) <= 40),  -- screen key
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  loan_id uuid
);

create index if not exists loan_request_drafts_unsent_idx
  on public.loan_request_drafts (updated_at desc) where sent_at is null;

alter table public.loan_request_drafts enable row level security;

revoke all on public.loan_request_drafts from anon, authenticated;
grant select on public.loan_request_drafts to authenticated;

drop policy if exists "admins read loan request drafts" on public.loan_request_drafts;
create policy "admins read loan request drafts" on public.loan_request_drafts
  for select to authenticated
  using (app_private.is_moodeng_admin());

-- The borrower's own write. A row that was already sent starts over as a new request.
create or replace function public.save_loan_request_draft(
  p_amount numeric,
  p_repay numeric,
  p_reason text,
  p_due_date text,
  p_stopped_at text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  insert into public.loan_request_drafts as d (user_id, amount, repay, reason, due_date, stopped_at)
  values (
    v_uid,
    case when p_amount >= 0 and p_amount < 1000000 then p_amount end,
    case when p_repay >= 0 and p_repay < 1000000 then p_repay end,
    nullif(left(btrim(coalesce(p_reason, '')), 2000), ''),
    nullif(left(btrim(coalesce(p_due_date, '')), 40), ''),
    nullif(left(btrim(coalesce(p_stopped_at, '')), 40), '')
  )
  on conflict (user_id) do update set
    amount = excluded.amount,
    repay = excluded.repay,
    reason = excluded.reason,
    due_date = excluded.due_date,
    stopped_at = excluded.stopped_at,
    started_at = case when d.sent_at is not null then now() else d.started_at end,
    updated_at = now(),
    sent_at = null,
    loan_id = null;
end;
$$;

revoke all on function public.save_loan_request_draft(numeric, numeric, text, text, text) from public, anon;
grant execute on function public.save_loan_request_draft(numeric, numeric, text, text, text) to authenticated;

-- A loan from this borrower = their request went out.
create or replace function app_private.mark_loan_request_draft_sent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.borrower_user_id is not null then
    update public.loan_request_drafts
       set sent_at = now(), loan_id = new.id
     where user_id = new.borrower_user_id and sent_at is null;
  end if;
  return new;
exception when others then
  -- Never let the admin mirror block a loan from being created.
  return new;
end;
$$;

drop trigger if exists loans_mark_request_draft_sent on public.loans;
create trigger loans_mark_request_draft_sent
  after insert on public.loans
  for each row execute function app_private.mark_loan_request_draft_sent();
