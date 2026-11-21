-- Admin → Support → WhatsApp: "who is this person?" next to every chat, and a people search.
-- Called only by the admin-messenger edge function (service role), which checks the caller is an admin.

-- One profile card per Moodeng user: who they are, how active, and where their loans stand.
create or replace function private.admin_person_card(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
   select jsonb_build_object(
      'userId', u.id,
      'username', u.username,
      'displayName', u.display_name,
      'kycName', k.full_name,
      'facebookName', u.facebook_name,
      'email', u.email,
      'phone', coalesce(nullif(u.whatsapp_number, ''), nullif(a.phone, '')),
      'market', u.market,
      'role', u.user_role,
      'accountStatus', u.account_status,
      'loanAccess', u.loan_access_status,
      'riskBand', u.current_risk_band,
      'kycStatus', coalesce(u.didit_id_status, u.is_didit),
      'signedUpAt', u.created_at,
      'lastSignInAt', a.last_sign_in_at,
      'whatsappContactId', u.whatsapp_contact_id,
      'loans', jsonb_build_object(
         'repaid', count(l.id) filter (where l.repayment_status = 'Paid'),
         'repaidLate', count(l.id) filter (where l.repayment_status = 'Paid' and l.repaid_at > l.due_date),
         'totalBorrowed', coalesce(sum(l.loan_amount) filter (where l.loan_status = 'Lent'), 0),
         'requested', count(l.id) filter (where l.loan_status = 'Requested'),
         'lastLoanAt', max(coalesce(l.funded_at, l.created_at))
      ),
      -- The loan that's out right now (funded, not fully repaid, not refunded or settled off-platform).
      'activeLoan', (
         select jsonb_build_object(
            'amount', x.loan_amount,
            'owed', greatest(coalesce(x.total_repayment_amount, x.loan_amount) - coalesce(x.repaid_amount, 0), 0),
            'dueDate', x.due_date,
            'fundedAt', x.funded_at,
            'status', x.repayment_status
         )
         from public.loans x
         where x.borrower_user_id = u.id
           and x.loan_status = 'Lent'
           and x.repayment_status <> 'Paid'
           and x.refunded_at is null
           and x.offplatform_settled_at is null
           and not coalesce(x.is_test, false)
         order by x.due_date nulls last
         limit 1
      )
   )
   from public.users u
   left join auth.users a on a.id = u.id
   left join lateral (
      select ki.full_name from public.kyc_identities ki
      where ki.user_id = u.id and ki.full_name is not null
      order by ki.fetched_at desc nulls last limit 1
   ) k on true
   left join public.loans l
      on l.borrower_user_id = u.id and not coalesce(l.is_test, false) and l.refunded_at is null
   where u.id = p_user_id
   group by u.id, a.phone, a.last_sign_in_at, k.full_name;
$$;

-- Match WhatsApp chats to Moodeng users: by the SendPulse contact id they confirmed with, else by phone
-- (the WhatsApp number they gave us or the number they signed up with). Returns
-- [{ contactId, matchedBy, card }] for the chats that match.
create or replace function public.admin_whatsapp_people(p_contacts jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
   with c as (
      select x->>'contactId' as contact_id, regexp_replace(coalesce(x->>'phone', ''), '\D', '', 'g') as phone
      from jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb)) x
   ),
   m as (
      select distinct on (c.contact_id) c.contact_id, u.id as user_id,
         case when u.whatsapp_contact_id = c.contact_id then 'whatsapp' else 'phone' end as matched_by
      from c
      join public.users u
         on u.whatsapp_contact_id = c.contact_id
         or (length(c.phone) >= 8 and regexp_replace(coalesce(u.whatsapp_number, ''), '\D', '', 'g') = c.phone)
         or (length(c.phone) >= 8 and exists (select 1 from auth.users a where a.id = u.id and regexp_replace(coalesce(a.phone, ''), '\D', '', 'g') = c.phone))
      order by c.contact_id, (u.whatsapp_contact_id = c.contact_id) desc, u.created_at desc
   )
   select coalesce(jsonb_agg(jsonb_build_object('contactId', m.contact_id, 'matchedBy', m.matched_by, 'card', private.admin_person_card(m.user_id))), '[]'::jsonb)
   from m;
$$;

-- Find Moodeng users by @username, name (display / KYC / Facebook), email or phone digits. Top 15.
create or replace function public.admin_people_search(p_query text)
returns jsonb
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
   with q as (
      select lower(trim(coalesce(p_query, ''))) as t, regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as digits
   ),
   hits as (
      select u.id, u.created_at
      from public.users u
      left join auth.users a on a.id = u.id
      cross join q
      where length(q.t) >= 2
        and not coalesce(u.is_test, false)
        and (
           lower(coalesce(u.username, '')) like '%' || ltrim(q.t, '@') || '%'
           or lower(coalesce(u.display_name, '')) like '%' || q.t || '%'
           or lower(coalesce(u.facebook_name, '')) like '%' || q.t || '%'
           or lower(coalesce(u.email, '')) like '%' || q.t || '%'
           or exists (select 1 from public.kyc_identities ki where ki.user_id = u.id and lower(coalesce(ki.full_name, '')) like '%' || q.t || '%')
           or (length(q.digits) >= 5 and (u.whatsapp_number like '%' || q.digits || '%' or a.phone like '%' || q.digits || '%'))
        )
      order by u.created_at desc
      limit 15
   )
   select coalesce(jsonb_agg(private.admin_person_card(hits.id) order by hits.created_at desc), '[]'::jsonb) from hits;
$$;

revoke all on function private.admin_person_card(uuid) from public, anon, authenticated;
revoke all on function public.admin_whatsapp_people(jsonb) from public, anon, authenticated;
revoke all on function public.admin_people_search(text) from public, anon, authenticated;
grant execute on function public.admin_whatsapp_people(jsonb) to service_role;
grant execute on function public.admin_people_search(text) to service_role;
