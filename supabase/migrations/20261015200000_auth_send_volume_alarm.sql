-- Alarm when sign-in emails or texts get close to Supabase's hourly auth limits (30 emails/h and
-- 30 SMS/h project-wide as of 2026-10-15). Past the limit, new sign-ups and code logins fail for
-- everyone until the hour rolls over, so the team gets a Telegram message at 20 to raise it in
-- Supabase → Authentication → Rate Limits.
--
-- auth.audit_log_entries is empty on this project, so the count comes from each account's
-- last-sent timestamps. One account asking twice in the hour counts once, so this undercounts a
-- little; the threshold sits well under the limit to make up for it.

create table if not exists private.auth_send_volume_alerts (
  kind text primary key,
  last_alert_at timestamptz not null
);

alter table private.auth_send_volume_alerts enable row level security;
revoke all on private.auth_send_volume_alerts from public, anon, authenticated;

create or replace function private.check_auth_send_volume(p_dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold constant int := 20;
  v_limit constant int := 30;
  v_quiet constant interval := interval '2 hours';
  v_emails int;
  v_texts int;
  v_token text;
  v_chat text;
  v_kind text;
  v_count int;
  v_msg text;
  v_sent text[] := '{}';
begin
  select
    count(*) filter (
      where coalesce(email, '') <> ''
        and greatest(
          coalesce(confirmation_sent_at, 'epoch'),
          coalesce(recovery_sent_at, 'epoch'),
          coalesce(email_change_sent_at, 'epoch'),
          coalesce(reauthentication_sent_at, 'epoch')
        ) > now() - interval '1 hour'
    ),
    count(*) filter (
      where coalesce(phone, '') <> ''
        and greatest(
          coalesce(confirmation_sent_at, 'epoch'),
          coalesce(recovery_sent_at, 'epoch'),
          coalesce(phone_change_sent_at, 'epoch'),
          coalesce(reauthentication_sent_at, 'epoch')
        ) > now() - interval '1 hour'
    )
  into v_emails, v_texts
  from auth.users;

  if p_dry_run then
    return jsonb_build_object('emails_last_hour', v_emails, 'texts_last_hour', v_texts, 'threshold', v_threshold);
  end if;

  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'TELEGRAM_API_TOKEN' limit 1;
  select value into v_chat from public.telegram_bot_settings where key = 'team_group_chat_id' limit 1;
  if v_token is null or v_chat is null then
    return jsonb_build_object('emails_last_hour', v_emails, 'texts_last_hour', v_texts, 'alerted', false, 'reason', 'no_telegram_config');
  end if;

  foreach v_kind in array array['emails', 'texts'] loop
    v_count := case v_kind when 'emails' then v_emails else v_texts end;
    continue when v_count < v_threshold;
    continue when exists (
      select 1 from private.auth_send_volume_alerts a
      where a.kind = v_kind and a.last_alert_at > now() - v_quiet
    );

    v_msg := format(
      E'⚠️ Moodeng sign-ups are busy: about %s sign-in %s went out in the last hour. Supabase allows %s per hour for the whole app; past that, new sign-ups and code logins fail until the hour resets.\n\nRaise it: Supabase → Authentication → Rate Limits.',
      v_count,
      case v_kind when 'emails' then 'emails' else 'texts' end,
      v_limit
    );

    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      body := jsonb_build_object('chat_id', v_chat, 'text', v_msg),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );

    insert into private.auth_send_volume_alerts (kind, last_alert_at)
    values (v_kind, now())
    on conflict (kind) do update set last_alert_at = excluded.last_alert_at;

    v_sent := v_sent || v_kind;
  end loop;

  return jsonb_build_object('emails_last_hour', v_emails, 'texts_last_hour', v_texts, 'alerted', v_sent);
end;
$$;

revoke execute on function private.check_auth_send_volume(boolean) from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'auth-send-volume-alarm';
select cron.schedule('auth-send-volume-alarm', '*/10 * * * *', $$select private.check_auth_send_volume();$$);
