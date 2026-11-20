-- Journey v2: once a borrower's proof of income has passed, a later send can't put them back on hold
-- (George 2026-11-20: "i dont want users getting stuck"). Before this only the LATEST send counted, so
-- answering our "send your GCash history too" question with a weaker document, or a flag added after
-- the fact, could stop someone who was already through from booking their call.
-- Only a team Decline on their latest send still stops them. Everything else as before.
create or replace function app_private.journey_income_check(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    -- George 2026-11-17: the AI's score 60+ passes by itself; anything lower waits for the team.
    -- Fraud signs (risk red) always wait for the team, whatever the score.
    select case
             when d.decision = 'approved' then 'pass'
             when d.decision = 'declined' then 'declined'
             -- An earlier send already passed: stay passed.
             when exists (
               select 1
               from public.income_documents e
               where e.user_id = p_user_id
                 and e.id <> d.id
                 and (e.decision = 'approved'
                      or (e.decision is null and e.status = 'done' and e.verdict is distinct from 'resend'
                          and e.risk is distinct from 'red' and e.score >= 60))
             ) then 'pass'
             when d.verdict = 'resend' then 'resend'
             when d.status in ('pending', 'processing') then 'checking'
             when d.risk = 'red' then 'hold'
             when d.score >= 60 then 'pass'
             else 'hold'
           end
    from public.income_documents d
    where d.user_id = p_user_id
    order by d.created_at desc
    limit 1
  ), 'none');
$$;

revoke all on function app_private.journey_income_check(uuid) from public, anon, authenticated;
