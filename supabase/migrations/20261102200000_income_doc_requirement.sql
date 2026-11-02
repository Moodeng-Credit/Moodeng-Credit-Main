-- Loans of income_doc_min_usd ($60) or more need a proof of income first. The loan form asks
-- get_income_doc_requirement(); "ok" = a send in the last 90 days that wasn't declined by the team
-- or sent back to fix (checking, in review and approved all count, so nobody waits on the team
-- to post the request — the team still reviews it). '0' or anything non-numeric turns it off.

insert into public.telegram_bot_settings (key, value, description)
values ('income_doc_min_usd', '60', 'Loan requests of this many USD or more need proof of income (moodeng.app/documents). 0 = off.')
on conflict (key) do nothing;

create or replace function public.get_income_doc_requirement()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'min_usd', case when s.value ~ '^\d+(\.\d+)?$' and s.value::numeric > 0 then s.value::numeric end,
    'ok', exists (
      select 1 from public.income_documents d
      where d.user_id = auth.uid()
        and d.created_at > now() - interval '90 days'
        and d.decision is distinct from 'declined'
        and (d.decision = 'approved' or d.verdict is distinct from 'resend')
    )
  )
  from (select (select value from public.telegram_bot_settings where key = 'income_doc_min_usd') as value) s;
$$;

revoke all on function public.get_income_doc_requirement() from public;
grant execute on function public.get_income_doc_requirement() to authenticated;
