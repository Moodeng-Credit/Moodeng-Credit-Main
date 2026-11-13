-- Repost wait only for spam (2026-11-13).
-- Before: a 2nd deleted request in 24 h → 30-minute wait. Borrowers who delete a request to fix the
-- amount/date and post again hit it right away (Kyle, Jasnah). Now: fixing a request is free up to
-- 5 deletes in 24 h; the 30-minute wait only starts at the 5th, so delete/repost loops that would
-- spam lenders are still stopped. The credit-limit trigger still caps how much can be live at once.

create or replace function public.get_loan_request_repost_status()
returns table (
  delete_count_24h integer,
  cooldown_until timestamptz,
  can_create boolean
)
language sql
security definer
set search_path = public
as $$
  with recent_deletes as (
    select deleted_at
    from public.loan_request_delete_events
    where borrower_user_id = auth.uid()
      and deleted_at > now() - interval '24 hours'
  ),
  delete_stats as (
    select count(*)::integer as delete_count_24h, max(deleted_at) as latest_deleted_at
    from recent_deletes
  )
  select
    delete_count_24h,
    case
      when delete_count_24h >= 5 and latest_deleted_at > now() - interval '30 minutes'
        then latest_deleted_at + interval '30 minutes'
      else null
    end as cooldown_until,
    not (delete_count_24h >= 5 and latest_deleted_at > now() - interval '30 minutes') as can_create
  from delete_stats;
$$;

-- The Indonesia Telegram bot repeats the same check inline (keyed on the borrower, not auth.uid()).
-- Patch just that threshold in the live definition and fail loudly if the text isn't there.
do $$
declare
  v_def text := pg_get_functiondef('public.bot_request_id_loan'::regproc);
  v_new text;
begin
  v_new := replace(v_def, 'if v_deletes >= 2 and v_last_delete', 'if v_deletes >= 5 and v_last_delete');
  v_new := replace(v_new, '-- 2+ deleted requests in 24 h', '-- 5+ deleted requests in 24 h');
  if v_new = v_def or v_new like '%v_deletes >= 2 and%' then
    raise exception 'bot_request_id_loan: repost check not found, nothing changed';
  end if;
  execute v_new;
end;
$$;
