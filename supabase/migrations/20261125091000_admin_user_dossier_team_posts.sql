-- admin_user_dossier: + team_posts (saved team Telegram posts about this person, newest 40).

create or replace function public.admin_user_dossier(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  result jsonb;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    return null;
  end if;

  select jsonb_build_object(
    'user', (
      select jsonb_build_object(
        'id', u.id, 'username', u.username, 'display_name', u.display_name, 'email', u.email,
        'created_at', u.created_at, 'updated_at', u.updated_at, 'user_role', u.user_role,
        'account_status', u.account_status, 'market', u.market, 'timezone', u.timezone,
        'preferred_locale', u.preferred_locale, 'is_test', u.is_test,
        'facebook_name', u.facebook_name, 'facebook_profile_url', u.facebook_profile_url,
        'messenger_verified_at', u.messenger_verified_at, 'instagram_handle', u.instagram_handle,
        'tiktok_handle', u.tiktok_handle, 'whatsapp_number', u.whatsapp_number,
        'whatsapp_verified_at', u.whatsapp_verified_at, 'viber_number', u.viber_number,
        'telegram_username', u.telegram_username, 'line_id', u.line_id,
        'wallet_address', u.wallet_address, 'wallet_provider', u.wallet_provider,
        'wallet_chain_id', u.wallet_chain_id, 'wallet_suspended', u.wallet_suspended,
        'walt_address', u.walt_address, 'maya_address', u.maya_address,
        'cs', u.cs, 'mal', u.mal, 'nal', u.nal, 'credit_progression_paused', u.credit_progression_paused,
        'current_risk_score', u.current_risk_score, 'current_risk_band', u.current_risk_band,
        'loan_access_status', u.loan_access_status, 'loan_access_approved_at', u.loan_access_approved_at,
        'loan_access_reject_reason', u.loan_access_reject_reason, 'loan_requests_blocked', u.loan_requests_blocked,
        'ghosted_at', u.ghosted_at, 'blocked_for_good_at', u.blocked_for_good_at
      ) || jsonb_build_object(
        'profession', u.profession, 'location', u.location, 'income_type', u.income_type,
        'income_description', u.income_description, 'monthly_income', u.monthly_income,
        'monthly_expenses', u.monthly_expenses, 'other_income', u.other_income,
        'payday_type', u.payday_type, 'payday_start', u.payday_start, 'payday_end', u.payday_end,
        'about_gender', u.about_gender, 'about_age', u.about_age, 'about_kids', u.about_kids,
        'is_didit', u.is_didit, 'is_world_id', u.is_world_id::text = 'ACTIVE', 'is_veriff', u.is_veriff,
        'didit_id_status', u.didit_id_status, 'didit_decline_reason', u.didit_decline_reason,
        'didit_submitted_at', u.didit_submitted_at, 'liveness_status', u.liveness_status,
        'wallet_face_status', u.wallet_face_status, 'wallet_face_checked_at', u.wallet_face_checked_at,
        'video_call_starts_at', u.video_call_starts_at, 'video_call_host', u.video_call_host,
        'video_call_outcome', u.video_call_outcome, 'video_call_outcome_at', u.video_call_outcome_at,
        'video_call_joined_at', u.video_call_joined_at, 'video_call_left_at', u.video_call_left_at,
        'signup_source', u.signup_source, 'signup_campaign', u.signup_campaign,
        'signup_referrer', u.signup_referrer, 'signup_landing', u.signup_landing,
        'signup_browser', u.signup_browser, 'signup_os', u.signup_os,
        'prescreen_path', u.prescreen_path, 'journey_videos_watched', u.journey_videos_watched
      )
      from public.users u where u.id = p_user_id
    ),
    'loans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'amount', l.loan_amount, 'total', l.total_repayment_amount, 'repaid', l.repaid_amount,
        'loan_status', l.loan_status, 'repayment_status', l.repayment_status, 'reason', l.reason,
        'created_at', l.created_at, 'funded_at', l.funded_at, 'due_date', l.due_date, 'repaid_at', l.repaid_at,
        'due_timezone', l.due_timezone, 'repayment_schedule_late_at', l.repayment_schedule_late_at,
        'refunded_at', l.refunded_at, 'market', l.market, 'funding_method', l.funding_method,
        'two_part', l.repayment_schedule is not null, 'on_hold_reason', l.on_hold_reason,
        'offplatform_settled_at', l.offplatform_settled_at, 'is_test', l.is_test
      ) order by l.created_at desc)
      from public.loans l where l.borrower_user_id = p_user_id
    ), '[]'::jsonb),
    'lent_count', (select count(*) from public.loans l where l.lender_user_id = p_user_id),
    'loan_cap', (
      select jsonb_build_object('cap_usd', c.cap_usd, 'note', c.note, 'set_at', c.set_at)
      from public.borrower_loan_caps c where c.user_id = p_user_id
    ),
    'access_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', r.kind, 'status', r.status, 'channel', r.channel, 'reason', r.reason,
        'created_at', r.created_at, 'decided_at', r.decided_at,
        'decided_by', r.decided_by
      ) order by r.created_at desc)
      from public.loan_access_requests r where r.user_id = p_user_id
    ), '[]'::jsonb),
    'kyc', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_status', k.session_status, 'session_created_at', k.session_created_at,
        'full_name', k.full_name, 'date_of_birth', k.date_of_birth, 'gender', k.gender,
        'document_type', k.document_type, 'issuing_state', k.issuing_state,
        'document_last4', right(k.document_number, 4), 'marital_status', k.marital_status,
        'city', k.city, 'province', k.province, 'region', k.region,
        'formatted_address', k.formatted_address, 'warnings', k.warnings
      ) order by k.session_created_at desc nulls last)
      from public.kyc_identities k where k.user_id = p_user_id
    ), '[]'::jsonb),
    'kyc_declines', coalesce((
      select jsonb_agg(jsonb_build_object('kind', d.kind, 'declined_at', d.declined_at, 'voided_at', d.voided_at)
        order by d.declined_at desc)
      from public.kyc_declines d where d.user_id = p_user_id
    ), '[]'::jsonb),
    'face_checks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'status', f.status, 'liveness_score', f.liveness_score, 'match_score', f.match_score,
        'decline_reason', f.decline_reason, 'amount', f.amount, 'created_at', f.created_at
      ) order by f.created_at desc)
      from (select * from public.cashout_face_checks where user_id = p_user_id order by created_at desc limit 10) f
    ), '[]'::jsonb),
    'call_screenings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'call_starts_at', s.call_starts_at, 'answers', s.answers, 'notes', s.notes,
        'red_flags', s.red_flags, 'score', s.score, 'created_at', s.created_at, 'updated_at', s.updated_at,
        'by', (select coalesce(a.display_name, du.username) from public.users du
               left join public.admin_users a on a.user_id = du.id where du.id = s.created_by limit 1)
      ) order by s.created_at desc)
      from public.call_screenings s where s.user_id = p_user_id
    ), '[]'::jsonb),
    'call_transcripts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'call_started_at', t.call_started_at, 'host', t.host, 'summary', t.summary,
        'risk_level', t.risk_level, 'form_check', t.form_check,
        'transcript', left(t.transcript, 30000)
      ) order by t.call_started_at desc nulls last)
      from (select * from public.call_transcripts where user_id = p_user_id order by call_started_at desc nulls last limit 5) t
    ), '[]'::jsonb),
    'team_posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', t.title, 'body', t.body, 'times', t.times, 'first_at', t.first_at,
        'last_at', t.last_at, 'edited_at', t.edited_at
      ) order by t.last_at desc)
      from (select * from public.team_posts where user_id = p_user_id order by last_at desc limit 40) t
    ), '[]'::jsonb),
    'call_events', coalesce((
      select jsonb_agg(jsonb_build_object('kind', e.kind, 'call_at', e.call_at, 'recorded_at', e.recorded_at)
        order by e.recorded_at desc)
      from (select * from public.call_events where user_id = p_user_id order by recorded_at desc limit 30) e
    ), '[]'::jsonb),
    'no_shows', coalesce((
      select jsonb_agg(jsonb_build_object('kind', n.kind, 'recorded_at', n.recorded_at, 'active', n.active)
        order by n.recorded_at desc)
      from public.video_call_no_shows n where n.user_id = p_user_id
    ), '[]'::jsonb),
    'bot_answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', b.kind, 'items', b.items, 'fit_verdict', b.fit_verdict, 'fit_reason', b.fit_reason,
        'created_at', b.created_at
      ) order by b.created_at desc)
      from (select * from public.booking_bot_answers where user_id = p_user_id order by created_at desc limit 5) b
    ), '[]'::jsonb),
    'prescreens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', p.created_at, 'status', p.status, 'score', p.score, 'verdict', p.verdict,
        'repay_chance', p.repay_chance, 'summary', p.grade->'summary', 'overall', p.grade->'overall',
        'flags', p.grade->'flags', 'repay_reasons', p.grade->'repay_reasons',
        'team_decision', p.team_decision, 'team_reason', p.team_reason, 'team_decided_at', p.team_decided_at
      ) order by p.created_at desc)
      from public.pre_screenings p where p.user_id = p_user_id
    ), '[]'::jsonb),
    'income_docs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'created_at', d.created_at, 'doc_type', d.doc_type, 'verdict', d.verdict, 'score', d.score,
        'risk', d.risk, 'repay_chance', d.repay_chance, 'repay_reasons', d.repay_reasons,
        'memo', d.memo, 'ai_note', d.ai_note, 'decision', d.decision, 'decision_reason', d.decision_reason,
        'decided_at', d.decided_at, 'metrics', d.metrics
      ) order by d.created_at desc)
      from public.income_documents d where d.user_id = p_user_id
    ), '[]'::jsonb),
    'risk_scores', coalesce((
      select jsonb_agg(jsonb_build_object('score', r.score, 'band', r.band, 'at', r.computed_at) order by r.computed_at)
      from (select * from public.risk_scores where user_id = p_user_id order by computed_at desc limit 60) r
    ), '[]'::jsonb),
    'risk_alerts', coalesce((
      select jsonb_agg(jsonb_build_object('severity', a.severity, 'signal', a.signal_key, 'message', a.message,
        'created_at', a.created_at) order by a.created_at desc)
      from (select * from public.risk_alerts where user_id = p_user_id order by created_at desc limit 20) a
    ), '[]'::jsonb),
    'linked_alert', (
      select jsonb_build_object('detail', l.detail, 'alerted_at', l.alerted_at,
        'auto_rejected_at', l.auto_rejected_at, 'team_cleared_at', l.team_cleared_at)
      from public.linked_account_alerts l where l.user_id = p_user_id
    ),
    'restriction', (
      select jsonb_build_object('status', r.status, 'reason', r.reason, 'admin_note', r.admin_note,
        'restricted_at', r.restricted_at)
      from public.admin_account_restrictions r where r.user_id = p_user_id
      order by r.created_at desc limit 1
    ),
    'activity', jsonb_build_object(
      'sign_ins', (select count(*) from public.login_feed_sign_ins s where s.user_id = p_user_id),
      'last_sign_in', (select max(s.signed_in_at) from public.login_feed_sign_ins s where s.user_id = p_user_id),
      'days_seen', (select count(distinct i.seen_on) from public.auth_ip_log i where i.user_id = p_user_id),
      'last_seen', (select max(i.last_seen_at) from public.auth_ip_log i where i.user_id = p_user_id),
      'ips', (select count(distinct i.ip_hash) from public.auth_ip_log i where i.user_id = p_user_id),
      'devices', (select count(distinct d.device_hash) from public.auth_device_log d where d.user_id = p_user_id),
      'hosting_ip', exists (select 1 from public.auth_ip_log i where i.user_id = p_user_id and i.is_hosting),
      'places', coalesce((
        select jsonb_agg(jsonb_build_object('city', x.city_name, 'country', x.country_iso, 'days', x.days,
          'last_seen', x.last_seen) order by x.last_seen desc)
        from (
          select i.city_name, i.country_iso, count(distinct i.seen_on) days, max(i.last_seen_at) last_seen
          from public.auth_ip_log i where i.user_id = p_user_id
          group by 1, 2 order by max(i.last_seen_at) desc limit 8
        ) x
      ), '[]'::jsonb),
      'messenger_messages', (select coalesce(sum(m.message_count), 0) from public.messenger_contacts m where m.user_id = p_user_id),
      'messenger_last_seen', (select max(m.last_seen_at) from public.messenger_contacts m where m.user_id = p_user_id),
      'push_devices', (select count(*) from public.push_subscriptions p where p.user_id = p_user_id),
      'reminders_sent', (select count(*) from public.messenger_reminder_sends r where r.user_id = p_user_id and r.status = 'sent')
    ),
    'rewards', jsonb_build_object(
      'trust_points', (select t.points_total from public.user_trust_points t where t.user_id = p_user_id),
      'iou_points', (select t.points_total from public.user_points t where t.user_id = p_user_id),
      'vouchers', coalesce((
        select jsonb_agg(jsonb_build_object('reward', v.reward, 'brand', v.brand, 'amount_php', v.amount_php,
          'status', v.status, 'created_at', v.created_at, 'sent_at', v.sent_at) order by v.created_at desc)
        from public.voucher_claims v where v.user_id = p_user_id
      ), '[]'::jsonb),
      'spins', (select count(*) from public.spins s where s.user_id = p_user_id and not s.is_test),
      'interest_refunds', coalesce((
        select jsonb_agg(jsonb_build_object('kind', r.kind, 'amount_usd', r.amount_usd, 'status', r.status,
          'created_at', r.created_at) order by r.created_at desc)
        from public.interest_refunds r where r.user_id = p_user_id
      ), '[]'::jsonb)
    ),
    'referrals', jsonb_build_object(
      'own_code', (select c.code from public.borrower_invite_codes c where c.user_id = p_user_id limit 1),
      'invited_by', (
        select jsonb_build_object('id', ru.id, 'username', ru.username, 'code', f.code, 'at', f.created_at)
        from public.friend_referrals f join public.users ru on ru.id = f.referrer_user_id
        where f.referred_user_id = p_user_id order by f.created_at limit 1
      ),
      'invited', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', fu.id, 'username', fu.username, 'at', f.created_at,
          'repaid', exists (select 1 from public.loans l where l.borrower_user_id = fu.id and l.repaid_at is not null)
        ) order by f.created_at desc)
        from public.friend_referrals f join public.users fu on fu.id = f.referred_user_id
        where f.referrer_user_id = p_user_id
      ), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$function$;

revoke all on function public.admin_user_dossier(uuid) from public, anon;
grant execute on function public.admin_user_dossier(uuid) to authenticated;
