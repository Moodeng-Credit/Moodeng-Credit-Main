with target_user as (
  select id
  from public.users
  where username = 'enadrosebellejane-319a72'
     or email = 'enadrosebellejane@gmail.com'
  limit 1
),
target_request as (
  select l.id
  from public.loans as l
  join target_user as u on u.id = l.borrower_user_id
  where l.loan_status = 'Requested'
  order by l.created_at desc
  limit 1
)
update public.loans as l
set borrower_context = '{
  "incomeSetup": "irregular",
  "paydayWindow": "varies",
  "cashGaps": ["family_needs"]
}'::jsonb
where l.id in (select id from target_request)
  and l.borrower_context is null;

do $$
declare
  target_user_id uuid;
begin
  select id
  into target_user_id
  from public.users
  where username = 'enadrosebellejane-319a72'
     or email = 'enadrosebellejane@gmail.com'
  limit 1;

  if target_user_id is not null then
    perform private.sync_completed_trust_milestones(target_user_id);
  end if;
end;
$$;
