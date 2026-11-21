-- Telegram alert for loan requests started but not sent (follows 20261115200000_loan_request_drafts).
--
-- Every 15 minutes loan-weekly-digest {event:'unsent_requests'} posts one card per request that's been
-- untouched for 30 minutes (and is under 3 days old), then stamps alerted_at so it's posted once.
-- Chat: telegram_bot_settings.unsent_requests_chat_id; when that's empty, kyc_alert_chat_id (the admin
-- channel that already gets new loan requests). To move the alerts to a new channel:
--   insert into telegram_bot_settings (key, value) values ('unsent_requests_chat_id', '<chat id>')
--   on conflict (key) do update set value = excluded.value;
--
-- A borrower who comes back and stops on a different screen is posted again (alerted_at clears when
-- the step changes or a new request starts after a sent one).
--
-- Apply only AFTER loan-weekly-digest is deployed with the unsent_requests event: an older deployment
-- ignores the event and would run the full weekly borrower digest every 15 minutes.

alter table public.loan_request_drafts add column if not exists alerted_at timestamptz;

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
    alerted_at = case when d.sent_at is not null or d.stopped_at is distinct from excluded.stopped_at then null else d.alerted_at end,
    updated_at = now(),
    sent_at = null,
    loan_id = null;
end;
$$;

revoke all on function public.save_loan_request_draft(numeric, numeric, text, text, text) from public, anon;
grant execute on function public.save_loan_request_draft(numeric, numeric, text, text, text) to authenticated;

do $$
begin
  perform cron.unschedule('unsent-loan-requests-15min');
exception
  when others then null;
end $$;

select cron.schedule(
  'unsent-loan-requests-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_PROJECT_URL' limit 1) || '/functions/v1/loan-weekly-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SUPABASE_SECRET_KEY' limit 1),
      'X-Admin-Token', (select decrypted_secret from vault.decrypted_secrets where name = 'ADMIN_API_TOKEN' limit 1)
    ),
    body := '{"event":"unsent_requests"}'::jsonb
  )
  $$
);
