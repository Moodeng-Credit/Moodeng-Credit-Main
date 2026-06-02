insert into public.milestone_definitions (
  id,
  point_source_id,
  title,
  description,
  category,
  borrower_stage,
  points_awarded,
  reward_label,
  outcome,
  benefit,
  action_label,
  action_path,
  rule_metadata
)
values
  (
    'profile-name-added',
    '7446f4ae-cc24-4718-8f98-f8ed7fc0afb9',
    'Add a bio name',
    'Save a friendly name lenders can recognize with your requests.',
    'basics',
    'starter',
    10000000,
    'Name visible to lenders',
    'Name added',
    'Recognizable profile',
    'Add name',
    '/request-board',
    '{"rule":"borrower_has_display_name"}'
  ),
  (
    'profile-image-added',
    'eb091789-5c5d-4d54-a927-87d58bea1206',
    'Add a profile image',
    'Save a photo, avatar, or character image lenders can recognize.',
    'basics',
    'starter',
    15000000,
    'Image visible to lenders',
    'Image added',
    'Recognizable profile',
    'Add image',
    '/request-board',
    '{"rule":"borrower_has_profile_image"}'
  ),
  (
    'borrower-background-complete',
    '9d3b05b2-4f6d-4ad2-8e60-29f11920f3a4',
    'Complete borrower bio',
    'Share work, payday, and short-term help context so lenders understand your request.',
    'basics',
    'starter',
    10000000,
    'Bio visible',
	    'Bio added',
    'Clearer request context',
    'Complete bio',
    '/request-board',
    '{"rule":"borrower_has_saved_context"}'
  )
on conflict (id) do update
set point_source_id = excluded.point_source_id,
    title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    borrower_stage = excluded.borrower_stage,
    points_awarded = excluded.points_awarded,
    reward_label = excluded.reward_label,
    outcome = excluded.outcome,
    benefit = excluded.benefit,
    action_label = excluded.action_label,
    action_path = excluded.action_path,
    rule_metadata = excluded.rule_metadata,
    is_active = true,
    updated_at = now();

create or replace function private.is_trust_milestone_complete(
  user_id_input uuid,
  milestone_id_input text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  on_time_paid_count integer := 0;
  funded_count integer := 0;
  unique_lender_count integer := 0;
  total_repaid numeric := 0;
  has_unresolved_default boolean := false;
  credit_limit integer := 0;
  is_verified boolean := false;
begin
  select
    coalesce(u.cs, 0),
    coalesce(u.is_world_id::text = 'ACTIVE', false)
  into credit_limit, is_verified
  from public.users as u
  where u.id = user_id_input;

  select count(*)::integer
  into funded_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.loan_status = 'Lent';

  select count(*)::integer
  into on_time_paid_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.repayment_status = 'Paid'
    and coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
    and l.updated_at <= l.due_date;

  select count(distinct l.lender_user_id)::integer
  into unique_lender_count
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.loan_status = 'Lent'
    and l.lender_user_id is not null;

  select coalesce(sum(coalesce(l.repaid_amount, 0)), 0)
  into total_repaid
  from public.loans as l
  where l.borrower_user_id = user_id_input
    and l.repayment_status = 'Paid';

  select exists (
    select 1
    from public.loans as l
    where l.borrower_user_id = user_id_input
      and l.loan_status = 'Lent'
      and coalesce(l.repayment_status::text, 'Unpaid') <> 'Paid'
      and l.due_date < now()
  )
  into has_unresolved_default;

  if milestone_id_input = 'verify-identity' then
    return is_verified;
  elsif milestone_id_input = 'first-loan-request' then
    return exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
    );
  elsif milestone_id_input = 'profile-name-added' then
    return exists (
      select 1
      from public.users as u
      where u.id = user_id_input
        and nullif(btrim(u.display_name), '') is not null
    );
  elsif milestone_id_input = 'profile-image-added' then
    return exists (
      select 1
      from public.users as u
      where u.id = user_id_input
        and nullif(btrim(u.avatar_url), '') is not null
    );
  elsif milestone_id_input = 'borrower-background-complete' then
    return exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.borrower_context is not null
        and jsonb_typeof(l.borrower_context) = 'object'
	        and l.borrower_context ? 'incomeSetup'
	        and l.borrower_context ? 'paydayWindow'
	        and l.borrower_context ? 'cashGaps'
	        and l.borrower_context ->> 'incomeSetup' in (
	          'full_time',
	          'part_time',
	          'contract',
	          'contract_temp',
	          'freelance',
	          'freelance_gig',
	          'none',
	          'no_income',
	          'self_employed',
	          'irregular',
	          'irregular_income'
	        )
	        and l.borrower_context ->> 'paydayWindow' in (
	          '1_5',
	          '10_15',
	          '15_20',
	          '25_30',
	          'irregular',
	          'varies',
	          'it_varies'
	        )
	        and jsonb_typeof(l.borrower_context -> 'cashGaps') = 'array'
	        and jsonb_array_length(l.borrower_context -> 'cashGaps') > 0
	        and l.borrower_context -> 'cashGaps' <@ '[
	          "gap_before_payday",
	          "bills_before_payday",
	          "transport",
	          "work_supplies",
	          "family_needs",
	          "food",
	          "medical",
	          "emergency_costs",
	          "emergency_expense"
	        ]'::jsonb
	    );
  elsif milestone_id_input = 'first-funded-loan' then
    return funded_count >= 1;
  elsif milestone_id_input = 'first-on-time-repayment' then
    return on_time_paid_count >= 1;
  elsif milestone_id_input = 'two-on-time-streak' then
    return on_time_paid_count >= 2;
  elsif milestone_id_input = 'full-limit-credit-builder' then
    return exists (
      select 1
      from public.loans as l
      where l.borrower_user_id = user_id_input
        and l.repayment_status = 'Paid'
        and coalesce(l.repaid_amount, 0) >= l.total_repayment_amount
        and l.updated_at <= l.due_date
        and l.loan_amount in (15, 20, 40, 60, 80, 100, 120, 140)
    );
  elsif milestone_id_input = 'two-unique-lenders' then
    return unique_lender_count >= 2;
  elsif milestone_id_input = 'repay-100-total' then
    return total_repaid >= 100;
  elsif milestone_id_input = 'reach-level-three' then
    return is_verified and credit_limit >= 40;
  elsif milestone_id_input = 'trusted-borrower-candidate' then
    return on_time_paid_count >= 5 and unique_lender_count >= 3 and not has_unresolved_default;
  end if;

  return false;
end;
$$;
