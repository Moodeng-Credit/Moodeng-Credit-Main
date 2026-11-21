-- WhatsApp tab profile: add who they are from Didit (age, gender, where they live), what they told us in
-- the application (job, income, payday), and the screening call (role, what the loan is for).
-- Used to pick affiliates and to see which areas we're reaching.

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
      -- From the ID check (Didit). Each field from the latest check that has it.
      'identity', jsonb_build_object(
         'gender', k.gender,
         'birthDate', k.date_of_birth,
         'age', case when k.date_of_birth is not null then date_part('year', age(current_date, k.date_of_birth))::int end,
         'city', k.city,
         'province', k.province,
         'region', k.region,
         'country', k.issuing_state
      ),
      -- What they told us when applying.
      'application', jsonb_build_object(
         'profession', nullif(trim(u.profession), ''),
         'incomeType', u.income_type,
         'incomeDescription', nullif(trim(u.income_description), ''),
         'monthlyIncome', u.monthly_income,
         'monthlyExpenses', u.monthly_expenses,
         'otherIncome', nullif(trim(u.other_income), ''),
         'paydayType', u.payday_type,
         'paydayStart', u.payday_start,
         'paydayEnd', u.payday_end,
         'location', nullif(trim(u.location), '')
      ),
      -- The screening call (Admin → Call approvals), latest one.
      'call', (
         select jsonb_build_object(
            'role', cs.answers->>'role',
            'loanUse', cs.answers->>'loanUse',
            'referral', cs.answers->>'referral',
            'notes', nullif(trim(cs.notes), ''),
            'at', coalesce(cs.call_starts_at, cs.created_at)
         )
         from public.call_screenings cs
         where cs.user_id = u.id
         order by cs.created_at desc
         limit 1
      ),
      'loans', jsonb_build_object(
         'repaid', count(l.id) filter (where l.repayment_status = 'Paid'),
         'repaidLate', count(l.id) filter (where l.repayment_status = 'Paid' and l.repaid_at > l.due_date),
         'totalBorrowed', coalesce(sum(l.loan_amount) filter (where l.loan_status = 'Lent'), 0),
         'requested', count(l.id) filter (where l.loan_status = 'Requested'),
         'lastLoanAt', max(coalesce(l.funded_at, l.created_at))
      ),
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
      -- A user can have several Didit checks; take each field from the newest check that has it.
      select
         (array_agg(ki.full_name order by ki.fetched_at desc nulls last) filter (where ki.full_name is not null))[1] as full_name,
         (array_agg(ki.gender order by ki.fetched_at desc nulls last) filter (where ki.gender is not null))[1] as gender,
         (array_agg(ki.date_of_birth order by ki.fetched_at desc nulls last) filter (where ki.date_of_birth is not null))[1] as date_of_birth,
         (array_agg(ki.city order by ki.fetched_at desc nulls last) filter (where ki.city is not null))[1] as city,
         (array_agg(ki.province order by ki.fetched_at desc nulls last) filter (where ki.province is not null))[1] as province,
         (array_agg(ki.region order by ki.fetched_at desc nulls last) filter (where ki.region is not null))[1] as region,
         (array_agg(ki.issuing_state order by ki.fetched_at desc nulls last) filter (where ki.issuing_state is not null))[1] as issuing_state
      from public.kyc_identities ki
      where ki.user_id = u.id
   ) k on true
   left join public.loans l
      on l.borrower_user_id = u.id and not coalesce(l.is_test, false) and l.refunded_at is null
   where u.id = p_user_id
   group by u.id, a.phone, a.last_sign_in_at, k.full_name, k.gender, k.date_of_birth, k.city, k.province, k.region, k.issuing_state;
$$;

-- Search also matches where they live (Didit city / province / region, application location) and job.
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
           or lower(coalesce(u.profession, '')) like '%' || q.t || '%'
           or lower(coalesce(u.location, '')) like '%' || q.t || '%'
           or exists (
              select 1 from public.kyc_identities ki
              where ki.user_id = u.id
                and lower(concat_ws(' ', ki.full_name, ki.city, ki.province, ki.region)) like '%' || q.t || '%'
           )
           or (length(q.digits) >= 5 and (u.whatsapp_number like '%' || q.digits || '%' or a.phone like '%' || q.digits || '%'))
        )
      order by u.created_at desc
      limit 25
   )
   select coalesce(jsonb_agg(private.admin_person_card(hits.id) order by hits.created_at desc), '[]'::jsonb) from hits;
$$;

revoke all on function private.admin_person_card(uuid) from public, anon, authenticated;
revoke all on function public.admin_people_search(text) from public, anon, authenticated;
grant execute on function public.admin_people_search(text) to service_role;
