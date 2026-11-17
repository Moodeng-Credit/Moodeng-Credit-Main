-- Trim database load (2026-11-17). The database was timing out new connections. pg_stat_statements
-- showed where the time went:
--   1. private.sms_otp_reconcile(): ~1 s per run, every 2 minutes, even with nothing to check
--      (about 40% of all query time).
--   2. pg_cron bookkeeping: every run writes and updates a cron.job_run_details row; the
--      every-minute nudge-away-replies job is the biggest source.
--   3. Three app calls: record_milestone_completion (re-checked on every dashboard load for
--      milestones already recorded), set_my_timezone (scans pg_timezone_names, ~0.5 s) and
--      my_id_onboarding (full Indonesia status for everyone, polled every 5 s on the ID screens).

-- ── 1. SMS check: skip the work when nothing is waiting, run every 5 minutes ────────────────────
create or replace function private.sms_otp_reconcile(p_now timestamp with time zone default now())
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sent      integer := 0;
  v_failed    integer := 0;
  v_reasons   text;
  v_balance   numeric;
  v_purged    integer := 0;
  v_busy      boolean;
  v_housekeep boolean := extract(minute from p_now) < 5;  -- purges once an hour
begin
  v_busy := exists (select 1 from private.sms_otp_sends where status = 'queued')
         or exists (select 1 from private.semaphore_balance_checks
                     where checked_at is null and created_at > p_now - interval '2 hours');

  if not v_busy and not v_housekeep then
    return jsonb_build_object('sent', 0, 'failed', 0, 'purged', 0, 'skipped', true);
  end if;

  if v_busy then
    with done as (
      update private.sms_otp_sends s
         set status = case when private.semaphore_send_ok(r.status_code, r.timed_out, r.error_msg, r.content) then 'sent' else 'failed' end,
             failure_reason = case when private.semaphore_send_ok(r.status_code, r.timed_out, r.error_msg, r.content) then null
                                   else private.semaphore_failure_reason(r.status_code, r.timed_out, r.error_msg, r.content) end,
             checked_at = p_now
        from net._http_response r
       where s.status = 'queued' and r.id = s.net_request_id
      returning s.status, s.failure_reason
    )
    select count(*) filter (where status = 'sent'),
           count(*) filter (where status = 'failed'),
           string_agg(distinct failure_reason, '; ')
      into v_sent, v_failed, v_reasons
      from done;

    with stuck as (
      update private.sms_otp_sends
         set status = 'failed', failure_reason = 'no response within 15 minutes', checked_at = p_now
       where status = 'queued' and created_at < p_now - interval '15 minutes'
      returning 1
    )
    select v_failed + count(*), case when count(*) > 0 then concat_ws('; ', v_reasons, 'no response within 15 minutes') else v_reasons end
      into v_failed, v_reasons
      from stuck;

    if v_failed > 0 then
      perform private.sms_alert('send_failed', format('%s text(s) failed in the last check (%s). Check credits / sender name in Semaphore.', v_failed, coalesce(v_reasons, 'unknown')));
    end if;

    if v_sent > 0 and (select count(*) from private.sms_otp_sends where status in ('queued', 'sent') and created_at > p_now - interval '24 hours') >= 300 then
      perform private.sms_alert('global_cap', '300 texts sent in the last 24 hours: new SMS code requests are refused (people are sent to email).');
    end if;

    update private.semaphore_balance_checks b
       set credit_balance = private.semaphore_credit_balance(r.status_code, r.content),
           checked_at = p_now
      from net._http_response r
     where b.checked_at is null and r.id = b.net_request_id;

    select credit_balance into v_balance
      from private.semaphore_balance_checks
     where checked_at = p_now and credit_balance is not null
     order by net_request_id desc limit 1;
    if v_balance is not null and v_balance < 200 then
      perform private.sms_alert('low_credit', format('Only %s Semaphore credits left (about %s texts at 2 credits each). Top up.', v_balance, floor(v_balance / 2)), interval '12 hours');
    end if;
  end if;

  if v_housekeep then
    with ours as (
      select net_request_id as id from private.sms_otp_sends
       where net_request_id is not null and created_at < p_now - interval '15 minutes' and created_at > p_now - interval '2 days'
      union all
      select net_request_id from private.semaphore_balance_checks
       where created_at < p_now - interval '15 minutes' and created_at > p_now - interval '2 days'
    ), del_resp as (
      delete from net._http_response r using ours where r.id = ours.id returning 1
    ), del_queue as (
      delete from net.http_request_queue q using ours where q.id = ours.id returning 1
    )
    select (select count(*) from del_resp) + (select count(*) from del_queue) into v_purged;

    delete from private.sms_otp_sends where created_at < p_now - interval '90 days';
    delete from private.sms_alerts where created_at < p_now - interval '90 days';
    delete from private.semaphore_balance_checks where created_at < p_now - interval '90 days';
  end if;

  return jsonb_build_object('sent', v_sent, 'failed', v_failed, 'purged', v_purged);
end;
$function$;

create index if not exists sms_otp_sends_queued_status_idx on private.sms_otp_sends (created_at) where status = 'queued';

-- ── 2. pg_cron: fewer runs, and keep its run log short ──────────────────────────────────────────
do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname = 'sms-otp-reconcile-2min';
  if v_job is not null then perform cron.alter_job(v_job, schedule := '*/5 * * * *'); end if;

  -- Away-reply nudges: every 5 minutes is plenty (was every minute).
  select jobid into v_job from cron.job where jobname = 'nudge-away-replies-1m';
  if v_job is not null then perform cron.alter_job(v_job, schedule := '*/5 * * * *'); end if;
end $$;

-- cron.job_run_details grows by a row per run forever; keep 3 days.
select cron.schedule('cron-run-log-trim-daily', '40 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '3 days' $$);

-- ── 3a. Milestones: an already-recorded milestone returns at once ───────────────────────────────
-- The dashboard calls this for every unlocked milestone on every load. Before, each call re-ran
-- the full criteria check and the rewards sync even when the milestone was recorded long ago.
create or replace function public.record_milestone_completion(
  user_id_input uuid,
  milestone_id_input text,
  metadata_input jsonb default '{}'::jsonb
)
returns table(applied boolean, milestone_id text, points_total bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = user_id_input and exists (
       select 1 from public.user_milestone_completions c
        where c.user_id = user_id_input and c.milestone_id = milestone_id_input) then
    return query
      select false, milestone_id_input,
             coalesce((select utp.points_total from public.user_trust_points utp where utp.user_id = user_id_input), 0)::bigint;
    return;
  end if;

  return query select * from private.record_milestone_completion(user_id_input, milestone_id_input, metadata_input);
end;
$$;
revoke all on function public.record_milestone_completion(uuid, text, jsonb) from public, anon;
grant execute on function public.record_milestone_completion(uuid, text, jsonb) to authenticated;

-- ── 3b. Time zone: no pg_timezone_names scan ────────────────────────────────────────────────────
-- pg_timezone_names reads every zone file (~0.5 s). Asking Postgres to convert a time in that
-- zone gives the same yes/no in microseconds.
create or replace function app_private.is_usable_timezone(p_zone text)
returns boolean
language plpgsql
stable
set search_path to ''
as $$
begin
  if p_zone is null
     or p_zone ~* '^(utc|gmt|etc/|zulu|universal|uct|posix|right/|factory|localtime|systemv/)'
     or p_zone !~ '^[A-Za-z]+/[A-Za-z0-9_+\-/]+$' then
    return false;
  end if;
  perform now() at time zone p_zone;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.set_my_timezone(p_zone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  -- Most calls report the zone we already have: nothing to check or write.
  if exists (select 1 from public.users where id = auth.uid() and timezone = p_zone) then
    return;
  end if;
  if not app_private.is_usable_timezone(p_zone) then
    return;
  end if;
  update public.users set timezone = p_zone where id = auth.uid() and timezone is distinct from p_zone;
end;
$$;
revoke all on function public.set_my_timezone(text) from public, anon;
grant execute on function public.set_my_timezone(text) to authenticated;

-- ── 3c. Indonesia status: skip the full check for everyone outside Indonesia ────────────────────
create or replace function public.my_id_onboarding()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_market text;
begin
  select u.market into v_market from public.users u where u.id = auth.uid();
  return case
           when v_market is distinct from 'ID' then jsonb_build_object('market', null)
           else coalesce(public.id_onboarding_status(auth.uid()), jsonb_build_object('market', null))
         end
         || jsonb_build_object('track', public.get_id_track(), 'rules', public.get_id_loan_rules());
end;
$$;
revoke execute on function public.my_id_onboarding() from public, anon;
grant execute on function public.my_id_onboarding() to authenticated;

-- The WhatsApp step looks up verified codes per user; index that lookup.
create index if not exists contact_verification_codes_verified_user_idx
  on public.contact_verification_codes (user_id, channel)
  where verified_at is not null;
