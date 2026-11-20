-- What we knew about a borrower when their loan was funded, next to how it turned out (George
-- 2026-11-21: "are we squeezing the most info out of the AI, prediction-wise?"). One row per funded loan.
-- The weekly report (loan-weekly-digest {event:'signal_report'}, _shared/signalReport.ts) groups these
-- to show which signals actually separate borrowers who repay on time from those who don't, so the AI
-- scores and cut-offs can be checked against reality instead of guessed.
--
-- Signals are taken AS OF FUNDING (the latest pre-screening / income document before funded_at), so a
-- check made after the loan can't make the past look predictable.
-- Outcome: on_time = repaid by the due time; just_after = repaid after it but within a day (the
-- 8 AM-deadline "same evening" pays); late = repaid later than that; unpaid = not repaid and more than
-- 1 day past due; not_due = still running. fast_repay = repaid within 48 h of funding (the fast-repay
-- rule's gaming pattern), reported on its own.
drop function if exists public.loan_signal_rows();
create function public.loan_signal_rows()
returns table(
  loan_id uuid,
  funded_at timestamptz,
  due_date timestamptz,
  outcome text,
  days_late integer,
  fast_repay boolean,
  signals jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with funded as (
    select l.*,
           coalesce(l.funded_at, l.created_at) as funded_on,
           row_number() over (partition by l.borrower_user_id order by coalesce(l.funded_at, l.created_at)) as loan_no
    from public.loans l
    where l.loan_status = 'Lent'
      and l.is_test is not true
      and l.refunded_at is null
      and l.borrower_user_id is not null
      and l.due_date is not null
  )
  select
    f.id,
    f.funded_on,
    f.due_date,
    case
      when f.repayment_status = 'Paid' and f.repaid_at is not null and f.repaid_at <= f.due_date then 'on_time'
      when f.repayment_status = 'Paid' and f.repaid_at is not null and f.repaid_at <= f.due_date + interval '1 day' then 'just_after'
      when f.repayment_status = 'Paid' or f.offplatform_settled_at is not null then 'late'
      when now() > f.due_date + interval '1 day' then 'unpaid'
      else 'not_due'
    end,
    case
      when f.repayment_status = 'Paid' and f.repaid_at is not null
        then greatest(0, ceil(extract(epoch from (f.repaid_at - f.due_date)) / 86400))::int
      when now() > f.due_date then ceil(extract(epoch from (now() - f.due_date)) / 86400)::int
      else 0
    end,
    f.repayment_status = 'Paid' and f.repaid_at is not null and f.repaid_at < f.funded_on + interval '48 hours',
    jsonb_build_object(
      'loan_no', case when f.loan_no = 1 then '1st loan' when f.loan_no = 2 then '2nd loan' else '3rd+ loan' end,
      'amount', case when f.loan_amount < 20 then 'under $20' when f.loan_amount < 50 then '$20–49'
                     when f.loan_amount < 100 then '$50–99' else '$100+' end,
      'market', coalesce(nullif(f.market, ''), u.market, 'PH'),
      'referred', case when f.referral_code_id is not null or u.redeemed_referral_code_id is not null then 'referred' else 'not referred' end,
      'video_call', case when u.video_call_outcome = 'attended' then 'call attended' else 'no call' end,
      'id_check', case when u.is_didit = 'ACTIVE' then 'Didit verified' else 'no Didit' end,
      'two_part', case when f.repayment_schedule is not null then '2-part loan' else 'one payment' end,
      'signup_to_loan', case
        when f.funded_on - u.created_at < interval '3 days' then 'loan within 3 days of signup'
        when f.funded_on - u.created_at < interval '15 days' then 'loan 3–14 days after signup'
        else 'loan 15+ days after signup' end,
      'prescreen', coalesce((
        select case when p.score is null then 'pre-screen not graded'
                    when p.score < 50 then 'pre-screen under 50'
                    when p.score < 70 then 'pre-screen 50–69'
                    else 'pre-screen 70+' end
        from public.pre_screenings p
        where p.user_id = f.borrower_user_id and p.created_at <= f.funded_on
        order by p.created_at desc limit 1), 'no pre-screen'),
      'income_doc', coalesce((
        select case when d.decision = 'declined' then 'income doc declined'
                    when d.risk = 'red' then 'income doc red'
                    when d.score >= 70 then 'income doc 70+'
                    when d.score is not null then 'income doc under 70'
                    else 'income doc not scored' end
        from public.income_documents d
        where d.user_id = f.borrower_user_id and d.created_at <= f.funded_on
        order by d.created_at desc limit 1), 'no income doc')
    )
  from funded f
  left join public.users u on u.id = f.borrower_user_id;
$$;

revoke all on function public.loan_signal_rows() from public, anon, authenticated;
grant execute on function public.loan_signal_rows() to service_role;
