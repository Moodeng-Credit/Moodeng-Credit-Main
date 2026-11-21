-- More free signals for the weekly "what predicts repayment" report (George 2026-11-21): their own
-- record before the loan, their referrer's record, when they asked, a weekend due day, and payday fit.
-- Same function and columns as 20261121090000, only more keys in `signals`, all as of funding.
create or replace function public.loan_signal_rows()
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
        order by d.created_at desc limit 1), 'no income doc'),
      -- Their own record before this loan: loans that were due and settled before it was funded.
      'past_record', coalesce((
        select case when bool_and(e.repaid_at is not null and e.repaid_at <= e.due_date) then 'always on time before'
                    else 'missed a due date before' end
        from public.loans e
        where e.borrower_user_id = f.borrower_user_id and e.id <> f.id and e.loan_status = 'Lent'
          and e.is_test is not true and e.refunded_at is null and e.due_date < f.funded_on
        having count(*) > 0), 'no earlier loan due'),
      -- Whoever referred them, and how that person has repaid (a borrower's circle tends to repay alike).
      'referrer_record', coalesce((
        select case when count(e.*) = 0 then 'referrer has no loans due'
                    when bool_and(e.repaid_at is not null and e.repaid_at <= e.due_date) then 'referrer always on time'
                    else 'referrer missed a due date' end
        from (select coalesce(
                (select rc.owner_user_id from public.referral_codes rc where rc.id = coalesce(f.referral_code_id, u.redeemed_referral_code_id)),
                (select fr.referrer_user_id from public.friend_referrals fr where fr.referred_user_id = f.borrower_user_id order by fr.created_at limit 1)
              ) as rid) r
        left join public.loans e on e.borrower_user_id = r.rid and e.loan_status = 'Lent' and e.is_test is not true
          and e.refunded_at is null and e.due_date < f.funded_on
        where r.rid is not null
        group by r.rid), 'not referred'),
      'request_time', case when extract(hour from f.created_at at time zone 'Asia/Bangkok') >= 22
                             or extract(hour from f.created_at at time zone 'Asia/Bangkok') < 6
                           then 'asked at night (10pm–6am)' else 'asked in the day' end,
      'due_day', case when extract(isodow from f.due_date at time zone 'Asia/Manila') in (6, 7) then 'due on a weekend' else 'due on a weekday' end,
      -- Payday (from their latest income document) against the due day: due 0–5 days after payday fits best.
      'payday_fit', coalesce((
        select case when ((extract(day from f.due_date at time zone 'Asia/Manila')::int - (d.metrics->'regular_deposits'->0->>'payday')::int + 31) % 31) <= 5
                    then 'due 0–5 days after payday' else 'due far from payday' end
        from public.income_documents d
        where d.user_id = f.borrower_user_id and d.created_at <= f.funded_on
          and (d.metrics->'regular_deposits'->0->>'payday') ~ '^[0-9]+$'
        order by d.created_at desc limit 1), 'payday unknown')
    )
  from funded f
  left join public.users u on u.id = f.borrower_user_id;
$$;

revoke all on function public.loan_signal_rows() from public, anon, authenticated;
grant execute on function public.loan_signal_rows() to service_role;
