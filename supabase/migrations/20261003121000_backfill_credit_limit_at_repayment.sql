-- Backfill loans.credit_limit_at_repayment for loans repaid before it was recorded.
--
-- Replays each borrower's fully repaid loans in order from the $15 start under the leveling rule (a
-- loan at or above the limit at the time is full-limit and unlocks the next tier; smaller loans don't),
-- and records the limit each loan was measured against. Only borrowers whose replay ends exactly on
-- their current limit are touched, so hand-set limits (test accounts) are left alone, and only verified
-- borrowers, since an unverified borrower has no limit. Idempotent: only fills nulls.
--
-- This makes the recorded limit the single source of truth, so the "replay from $15" fallbacks in the
-- milestone function, the edge function and the app can go.

with recursive paid as (
  select l.id, l.borrower_user_id as uid, l.loan_amount::numeric as amt,
         row_number() over (partition by l.borrower_user_id order by coalesce(l.repaid_at, l.updated_at), l.id) as rn
  from public.loans l
  where l.repayment_status = 'Paid' and l.refunded_at is null and l.is_test is not true
    and l.total_repayment_amount > 0 and l.repaid_amount >= l.total_repayment_amount
),
sim(id, uid, rn, amt, lim_before, lim_after) as (
  select p.id, p.uid, p.rn, p.amt, 15::numeric, (case when p.amt >= 15 then 20 else 15 end)::numeric
  from paid p where p.rn = 1
  union all
  select p.id, p.uid, p.rn, p.amt, s.lim_after,
         case when p.amt >= s.lim_after and s.lim_after < 140
              then (select min(t) from unnest(array[15,20,40,60,80,100,120,140]) as t where t > s.lim_after)::numeric
              else s.lim_after end
  from sim s join paid p on p.uid = s.uid and p.rn = s.rn + 1
),
final as (select distinct on (uid) uid, lim_after from sim order by uid, rn desc)
update public.loans l
   set credit_limit_at_repayment = s.lim_before
  from sim s
  join final f on f.uid = s.uid
  join public.users u on u.id = s.uid
 where l.id = s.id
   and l.credit_limit_at_repayment is null
   and f.lim_after = least(greatest(coalesce(u.cs, 0), 15), 140)
   and (u.is_world_id::text = 'ACTIVE' or u.is_didit::text = 'ACTIVE');
