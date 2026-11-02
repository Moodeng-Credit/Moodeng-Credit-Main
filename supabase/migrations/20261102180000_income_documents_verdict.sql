-- Income documents, Didit-style: every send gets named checks (pass / warn / fail) and one verdict.
--   resend        a problem the borrower can fix (blurry, locked PDF, wrong document, too old, too
--                 short, no money in) — they're told right away on /documents and by push /
--                 Messenger / Telegram, no team decision needed
--   needs_review  possible fake, someone else's document, or a repayment risk — the team decides;
--                 the borrower only sees "in review"
--   looks_good    every check passed — still the team's call (no auto-approve)
-- Set by kyc-cross-check (_shared/incomeDocs.ts).

alter table public.income_documents
  add column if not exists verdict text check (verdict in ('resend', 'needs_review', 'looks_good')),
  add column if not exists resend_reason text,
  add column if not exists checks jsonb;

-- Borrower view: a send the AI sent back shows as stage 'resend' with the fix (reason = code;
-- the app has the wording). Team decisions still win.
create or replace function public.get_my_income_document()
returns table (id uuid, stage text, file_count integer, sent_at timestamptz, decided_at timestamptz, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id,
         case when d.decision is not null then d.decision
              when d.verdict = 'resend' then 'resend'
              when d.status in ('pending', 'processing') and d.created_at > now() - interval '5 minutes' then 'checking'
              else 'in_review' end,
         jsonb_array_length(d.files),
         d.created_at,
         d.decided_at,
         case when d.decision = 'declined' then d.decision_reason
              when d.decision is null and d.verdict = 'resend' then d.resend_reason end
  from public.income_documents d
  where d.user_id = auth.uid()
  order by d.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_income_document() from public;
grant execute on function public.get_my_income_document() to authenticated;
