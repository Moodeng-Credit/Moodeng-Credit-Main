-- Per-borrower mule-risk score (Part A, step 4 — MULE_HUNTER-style graph context).
--
-- PROTOTYPE — additive, read-only (returns jsonb, writes nothing). NOT auto-applied.
-- Do NOT `supabase db push` to land this; prod has diverged both ways. Apply this ONE
-- statement deliberately (review in the SQL editor / a targeted migration) once approved.
--
-- Why this exists: scan_payout_convergence already catches the STRUCTURE (one destination,
-- many borrowers = a herder; fast off-ramp = bust-out speed). What it does not give is a
-- single 0..100 risk number per borrower that PROPAGATES known-bad labels across the graph
-- — MULE_HUNTER's "2-hop neighborhood fraud density" signal. UPI is irrelevant here; the
-- method is pure transaction-graph reasoning, and our graph is loan_fund_flow:
--
--     borrower ──(loan funds)──▶ terminal_destination ◀──(loan funds)── another borrower
--
-- Two borrowers are 1 hop apart in the projected borrower-graph when they share a terminal
-- destination (2 hops in the bipartite graph). We seed "known bad" from banned/blocked
-- users + destinations already flagged shared_payout_destination, then score every borrower
-- by how close they sit to that badness, plus their own velocity signal.
--
-- Weights are deliberately legible (not a trained model) so a reviewer can defend each
-- point of a score — the explainability MULE_HUNTER leans on. Tune in one place below.

create or replace function public.score_borrower_mule_risk(
  top_n integer default 50,
  fast_offramp_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
begin
  with
  -- Edges: borrower ↔ terminal destination (drop rows with no borrower).
  edges as (
    select f.borrower_user_id as uid,
           f.terminal_destination as dest,
           f.loan_id,
           f.is_exchange_deposit,
           f.funded_at,
           f.first_out_at
    from public.loan_fund_flow f
    where f.borrower_user_id is not null
  ),
  -- Seed set 1: banned / blocked borrowers (known-bad nodes).
  banned as (
    select id as uid from public.users where account_status in ('banned', 'blocked')
  ),
  -- Seed set 2: destinations already flagged as a shared payout (herder sink).
  flagged_dest as (
    select subject_key as dest
    from public.fraud_signal_alerts
    where signal_type = 'shared_payout_destination'
  ),
  -- Fan-in per destination: how many DISTINCT borrowers funnel into it.
  dest_fanin as (
    select dest, count(distinct uid) as borrower_count
    from edges group by dest
  ),
  -- 1-hop neighbourhood: for each borrower, the destinations they touch and who else
  -- touches them, flagged where a co-borrower is banned or the dest is known-bad.
  dest_flags as (
    select e.dest,
           bool_or(b.uid is not null)                              as has_banned_borrower,
           (fd.dest is not null)                                   as is_flagged_dest,
           max(df.borrower_count)                                  as fanin
    from edges e
    left join banned b on b.uid = e.uid
    left join flagged_dest fd on fd.dest = e.dest
    left join dest_fanin df on df.dest = e.dest
    group by e.dest, fd.dest
  ),
  -- 2-hop propagation: a destination is "near badness" when it shares a borrower with
  -- ANOTHER destination that is itself flagged/banned-adjacent.
  dest_two_hop as (
    select distinct e1.dest
    from edges e1
    join edges e2 on e2.uid = e1.uid and e2.dest <> e1.dest
    join dest_flags df2 on df2.dest = e2.dest
    where df2.has_banned_borrower or df2.is_flagged_dest
  ),
  -- Per-borrower feature roll-up across all destinations they touch.
  borrower_features as (
    select e.uid,
           bool_or(dfl.has_banned_borrower)                        as near_banned,
           bool_or(dfl.is_flagged_dest)                            as on_flagged_dest,
           bool_or(dfl.fanin > 1)                                  as on_shared_dest,
           bool_or(th.dest is not null)                            as two_hop_to_bad,
           bool_or(e.is_exchange_deposit
                   and e.funded_at is not null and e.first_out_at is not null
                   and e.first_out_at <= e.funded_at + make_interval(hours => fast_offramp_hours))
                                                                   as fast_offramp,
           greatest(max(dfl.fanin) - 1, 0)                         as max_co_borrowers,
           jsonb_agg(distinct e.dest)                              as destinations
    from edges e
    join dest_flags dfl on dfl.dest = e.dest
    left join dest_two_hop th on th.dest = e.dest
    group by e.uid
  ),
  scored as (
    select bf.*,
           least(100,
             (case when bf.near_banned      then 45 else 0 end)
           + (case when bf.on_flagged_dest  then 40 else 0 end)
           + (case when bf.fast_offramp     then 20 else 0 end)
           + (case when bf.two_hop_to_bad   then 15 else 0 end)
           + least(bf.max_co_borrowers * 10, 20)
           ) as score
    from borrower_features bf
  )
  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.score desc), '[]'::jsonb)
  into result
  from (
    select s.uid                                as user_id,
           u.username,
           u.account_status,
           s.score,
           -- Human-readable reasons, so a reviewer can defend the number.
           (select jsonb_agg(r) from (select unnest(array_remove(array[
              case when s.near_banned     then 'shares a payout address with a banned account' end,
              case when s.on_flagged_dest then 'funds a flagged shared-payout destination' end,
              case when s.fast_offramp    then 'loan hit an exchange within '||fast_offramp_hours||'h' end,
              case when s.two_hop_to_bad  then 'two hops from a known-bad destination' end,
              case when s.max_co_borrowers > 0 then s.max_co_borrowers||' other borrower(s) share a destination' end
           ], null)) as r) reasons)             as reasons,
           s.max_co_borrowers,
           s.destinations
    from scored s
    join public.users u on u.id = s.uid
    where s.score > 0
    order by s.score desc
    limit top_n
  ) t;

  return result;
end;
$$;

comment on function public.score_borrower_mule_risk(integer, integer) is
  'PROTOTYPE per-borrower mule-risk score (0..100) from loan_fund_flow graph + fraud_signal_alerts. Read-only. Not auto-applied.';

-- Admins call the read-only scorer from the "Mule risk" admin tab.
grant execute on function public.score_borrower_mule_risk(integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Cron wrapper: emit a deduped alert the FIRST time a borrower crosses the
-- high-risk threshold, in the same {signals:[...]} shape fraud-signal-scan and
-- buildFraudAlertMessage already consume. Alert-once (dedup via
-- fraud_signal_alerts), matching scan_wallet_fraud_signals / scan_payout_convergence.
-- ---------------------------------------------------------------------------
create or replace function public.scan_mule_risk(
  min_score integer default 60,
  top_n integer default 200,
  fast_offramp_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_signals jsonb := '[]'::jsonb;
  rec jsonb;
  uid text;
  sev text;
begin
  for rec in
    select value from jsonb_array_elements(public.score_borrower_mule_risk(top_n, fast_offramp_hours))
  loop
    if (rec->>'score')::int < min_score then continue; end if;
    uid := rec->>'user_id';
    -- Alert once per borrower — a rising score doesn't re-fire (no alert fatigue).
    if exists (select 1 from public.fraud_signal_alerts a
               where a.signal_type = 'high_mule_risk' and a.subject_key = uid) then
      continue;
    end if;
    sev := case when (rec->>'score')::int >= 80 then 'critical' else 'warning' end;
    insert into public.fraud_signal_alerts (signal_type, subject_key, details)
    values ('high_mule_risk', uid,
            jsonb_build_object('score', rec->'score', 'reasons', rec->'reasons',
                               'username', rec->'username', 'destinations', rec->'destinations'));
    new_signals := new_signals || jsonb_build_object(
      'type', 'high_mule_risk', 'severity', sev,
      'user_id', uid, 'username', rec->>'username',
      'score', (rec->>'score')::int,
      'details', jsonb_build_object('reasons', rec->'reasons'));
  end loop;
  return jsonb_build_object('signals', new_signals);
end;
$$;

comment on function public.scan_mule_risk(integer, integer, integer) is
  'PROTOTYPE: emits deduped high_mule_risk signals (score >= min_score) for the fraud-signal-scan cron. Not auto-applied.';
