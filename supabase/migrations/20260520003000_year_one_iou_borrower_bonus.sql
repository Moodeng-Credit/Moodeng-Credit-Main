insert into public.point_events (user_id, event_type, delta, source_type, source_id, created_at, metadata)
select
  l.lender_user_id,
  'funded',
  0,
  'loan',
  l.id,
  coalesce(l.funded_at, l.updated_at, l.created_at, now()),
  jsonb_build_object(
    'loan_id', l.id,
    'loan_amount', l.loan_amount::text,
    'loan_tracking_id', l.tracking_id,
    'loan_funded_at', l.funded_at,
    'backfilled', true
  )
from public.loans l
where l.loan_status = 'Lent'
  and l.lender_user_id is not null
  and l.borrower_user_id is not null
on conflict (user_id, source_type, source_id, event_type) do nothing;

with funded_iou_events as (
  select
    pe.id as event_id,
    pe.user_id,
    pe.created_at as event_created_at,
    l.id as loan_id,
    l.borrower_user_id,
    l.loan_amount
  from public.point_events pe
  join public.loans l
    on l.id = pe.source_id
  where pe.source_type = 'loan'
    and pe.event_type = 'funded'
    and l.borrower_user_id is not null
),
recalculated_events as (
  select
    funded_iou_events.event_id,
    prior_counts.prior_funded_loan_count,
    case
      when prior_counts.prior_funded_loan_count = 0 then 25
      when prior_counts.prior_funded_loan_count = 1 then 20
      when prior_counts.prior_funded_loan_count = 2 then 15
      else 10
    end as borrower_bonus_points,
    (
      floor(funded_iou_events.loan_amount::numeric * 1000000)::bigint
      + (
        case
          when prior_counts.prior_funded_loan_count = 0 then 25
          when prior_counts.prior_funded_loan_count = 1 then 20
          when prior_counts.prior_funded_loan_count = 2 then 15
          else 10
        end * 1000000
      )::bigint
    ) as new_delta
  from funded_iou_events
  cross join lateral (
    select count(*)::integer as prior_funded_loan_count
    from funded_iou_events prior_events
    where prior_events.borrower_user_id = funded_iou_events.borrower_user_id
      and (
        prior_events.event_created_at < funded_iou_events.event_created_at
        or (
          prior_events.event_created_at = funded_iou_events.event_created_at
          and prior_events.event_id < funded_iou_events.event_id
        )
      )
  ) prior_counts
)
update public.point_events pe
set
  delta = recalculated_events.new_delta,
  metadata = coalesce(pe.metadata, '{}'::jsonb) || jsonb_build_object(
    'reward_year', 1,
    'base_points_per_usdc', 1,
    'borrower_prior_funded_loan_count', recalculated_events.prior_funded_loan_count,
    'borrower_loan_number', recalculated_events.prior_funded_loan_count + 1,
    'borrower_bonus_points', recalculated_events.borrower_bonus_points
  )
from recalculated_events
where pe.id = recalculated_events.event_id;

insert into public.user_points (user_id, points_total, updated_at, last_event_id)
select
  pe.user_id,
  sum(pe.delta)::bigint as points_total,
  now() as updated_at,
  max(pe.id) as last_event_id
from public.point_events pe
group by pe.user_id
on conflict (user_id) do update
  set points_total = excluded.points_total,
      updated_at = now(),
      last_event_id = excluded.last_event_id;
