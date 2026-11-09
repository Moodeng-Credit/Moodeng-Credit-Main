-- Indonesia track: the WhatsApp step also counts as done when the borrower ever confirmed a WhatsApp
-- code sent from a +62 number (contact_verification_codes.sender_wa_id), not only while
-- users.whatsapp_verified_at is set.
--
-- 2026-11-09: a tester verified on Oct 26 from his +62 number, but his users.whatsapp_verified_at was
-- later cleared. The step asked again, SendPulse didn't pass his new code on, and he went round in a
-- loop on step 2 with no way out. A code row the server confirmed is the same proof, so it counts.
-- Only the `whatsapp` line changes; the rest is 20261108130000_indonesia_walt_username_step.sql as-is.

create or replace function public.id_onboarding_status(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with u as (select * from public.users where id = p_user_id),
  doc as (
    select d.decision, d.verdict, d.created_at
    from public.income_documents d where d.user_id = p_user_id
    order by d.created_at desc limit 1
  ),
  s as (
    select
      u.market,
      u.chat_id is not null as telegram,
      (coalesce(u.whatsapp_verified_at is not null and regexp_replace(coalesce(u.whatsapp_number, ''), '\D', '', 'g') like '62%', false)
        or exists (select 1 from public.contact_verification_codes c
                   where c.user_id = u.id and c.channel = 'whatsapp' and c.verified_at is not null
                     and regexp_replace(coalesce(c.sender_wa_id, ''), '\D', '', 'g') like '62%')) as whatsapp,
      (u.messenger_verified_at is not null and u.facebook_profile_url is not null and u.facebook_page_followed_at is not null) as facebook,
      (u.messenger_verified_at is not null) as messenger,
      (u.facebook_profile_url is not null and u.facebook_page_followed_at is not null) as facebook_profile,
      (u.income_type is not null) as about,
      exists (select 1 from doc where doc.decision is distinct from 'declined'
                                  and (doc.decision = 'approved' or doc.verdict is distinct from 'resend')) as income,
      coalesce((select doc.decision from doc), case when (select doc.verdict from doc) = 'resend' then 'resend' end) as income_state,
      coalesce(u.is_didit = 'ACTIVE', false) as kyc_approved,
      coalesce(u.is_didit = 'ACTIVE'
        or lower(coalesce(u.didit_id_status, '')) like '%review%'
        or (u.didit_submitted_at is not null
            and lower(coalesce(u.didit_id_status, '')) not in ('duplicate', 'declined', 'abandoned', 'expired', 'not started', 'in progress')), false) as kyc,
      lower(coalesce(u.didit_id_status, '')) as kyc_state,
      (u.walt_address is not null or (u.walt_ready_at is not null and nullif(trim(coalesce(u.telegram_username, '')), '') is not null)) as walt,
      coalesce(u.loan_access_status in ('pending', 'approved'), false) as call,
      coalesce(u.loan_access_status, 'none') as access
    from u
  )
  select case when s.market is distinct from 'ID' then jsonb_build_object('market', null)
  else jsonb_build_object(
    'market', 'ID',
    'steps', jsonb_build_object(
      'telegram', s.telegram, 'whatsapp', s.whatsapp, 'facebook', s.facebook, 'about', s.about,
      'income', s.income, 'kyc', s.kyc, 'walt', s.walt, 'call', s.call),
    'messenger', s.messenger,
    'facebookProfile', s.facebook_profile,
    'incomeState', s.income_state,
    'kycApproved', s.kyc_approved,
    'kycState', s.kyc_state,
    'access', s.access,
    -- KYC can start once everything before it is done.
    'readyForKyc', s.telegram and s.whatsapp and s.facebook and s.about and s.income,
    -- The call can be booked once everything before it is done (KYC submitted is enough to book;
    -- the team only ✅s once KYC is approved).
    'readyForCall', s.telegram and s.whatsapp and s.facebook and s.about and s.income and s.kyc and s.walt,
    'next', case
      when not s.telegram then 'telegram'
      when not s.whatsapp then 'whatsapp'
      when not s.facebook then 'facebook'
      when not s.about then 'about'
      when not s.income then 'income'
      when not s.kyc then 'kyc'
      when not s.walt then 'walt'
      when not s.call then 'call'
      when s.access = 'approved' then 'apply'
      else 'waiting' end)
  end
  from s;
$$;

