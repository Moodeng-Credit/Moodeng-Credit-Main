alter table public.loans
add column if not exists borrower_context jsonb;

alter table public.loans
drop constraint if exists loans_borrower_context_shape_check;

alter table public.loans
add constraint loans_borrower_context_shape_check
check (
  borrower_context is null
  or (
    jsonb_typeof(borrower_context) = 'object'
	    and borrower_context ? 'incomeSetup'
	    and borrower_context ? 'paydayWindow'
	    and borrower_context ? 'cashGaps'
	    and borrower_context ->> 'incomeSetup' in (
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
	    and borrower_context ->> 'paydayWindow' in (
	      '1_5',
	      '10_15',
	      '15_20',
	      '25_30',
	      'irregular',
	      'varies',
	      'it_varies'
	    )
	    and jsonb_typeof(borrower_context -> 'cashGaps') = 'array'
	    and jsonb_array_length(borrower_context -> 'cashGaps') > 0
	    and borrower_context -> 'cashGaps' <@ '[
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
	  )
	);
