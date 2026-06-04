-- =================================================================
-- Consensus Risk Score (CRS) — schema + computation
-- Tables: public.risk_scores, public.risk_disposable_email_domains
-- Function: public.compute_risk_score(uuid)
-- Trigger functions: enqueue_risk_recompute_for_loan / _for_event,
--                    compute_risk_score_on_signup
-- Mirrors final score into existing admin_risk_profiles
-- (algorithm_version = 'consensus_v1') so the admin panel reads it
-- with no extra plumbing.
-- =================================================================

-- ---------- Tables -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.risk_scores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score           integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  band            text    NOT NULL CHECK (band IN ('Low','Medium','High','Critical')),
  signal_breakdown jsonb  NOT NULL DEFAULT '{}'::jsonb,
  trigger         text    NOT NULL CHECK (trigger IN ('daily_batch','loan_request','repayment','point_event','manual','signup')),
  computed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS risk_scores_user_id_computed_at_idx
  ON public.risk_scores (user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS risk_scores_band_idx
  ON public.risk_scores (band);

CREATE TABLE IF NOT EXISTS public.risk_disposable_email_domains (
  domain text PRIMARY KEY
);
INSERT INTO public.risk_disposable_email_domains (domain) VALUES
  ('mailinator.com'),('tempmail.com'),('10minutemail.com'),('guerrillamail.com'),
  ('throwaway.email'),('yopmail.com'),('trashmail.com'),('temp-mail.org'),
  ('fakeinbox.com'),('getnada.com'),('mintemail.com'),('dispostable.com')
ON CONFLICT DO NOTHING;

-- Convenience: cache the latest score on the user row.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS current_risk_score integer,
  ADD COLUMN IF NOT EXISTS current_risk_band  text,
  ADD COLUMN IF NOT EXISTS risk_computed_at   timestamptz;

-- ---------- The compute function ---------------------------------

CREATE OR REPLACE FUNCTION public.compute_risk_score(p_user_id uuid)
RETURNS public.risk_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  u                  public.users%ROWTYPE;
  age_seconds        numeric;
  email_domain       text;
  is_disposable      boolean;
  email_prefix_norm  text;

  s_i numeric := 0; s_v numeric := 0; s_r numeric := 0;
  s_n numeric := 0; s_a numeric := 0; s_e numeric := 0; s_b numeric := 0;

  factors_i text[] := '{}';
  factors_v text[] := '{}';
  factors_r text[] := '{}';
  factors_n text[] := '{}';
  factors_a text[] := '{}';
  factors_e text[] := '{}';
  factors_b text[] := '{}';

  first_loan_at   timestamptz;
  loans_24h       int;
  total_loans     int;
  paid_on_time    int;
  paid_late       int;
  paid_very_late  int;
  overdue_now     int;
  partial         int;
  raw_r           numeric;
  shared_chat     int;
  shared_email_pref int;
  bad_referral    int;
  reciprocity     int;
  self_lend_hard  int;
  cluster_size    int;
  short_age_pair  int;
  median_request  numeric;
  recent_request  numeric;
  ratio           numeric;
  utilization     numeric;
  reminder_count  int;
  user_points_total bigint;
  has_any_event   boolean;
  request_intervals numeric[];
  interval_stddev numeric;
  interval_mean   numeric;
  amount_uniqueness numeric;
  total_user_loans int;
  round_amount_count int;
  same_minute_count int;
  user_modify_delta numeric;
  final_score     int;
  band            text;
  breakdown       jsonb;
  inserted        public.risk_scores%ROWTYPE;
BEGIN
  SELECT * INTO u FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'compute_risk_score: user % not found', p_user_id; END IF;
  age_seconds := EXTRACT(EPOCH FROM (now() - COALESCE(u.created_at, now())));

  -- S1 Identity
  IF u.is_world_id IS DISTINCT FROM 'ACTIVE'::world_id_status THEN
    s_i := s_i + 30; factors_i := factors_i || 'world_id_inactive';
  END IF;
  IF u.google_id IS NULL THEN s_i := s_i + 15; factors_i := factors_i || 'no_google_id'; END IF;
  IF u.telegram_id IS NULL THEN s_i := s_i + 10; factors_i := factors_i || 'no_telegram_id'; END IF;
  IF u.wallet_address IS NULL OR length(u.wallet_address) < 10 THEN
    s_i := s_i + 20; factors_i := factors_i || 'no_wallet';
  END IF;
  email_domain := lower(split_part(COALESCE(u.email,''), '@', 2));
  SELECT EXISTS(SELECT 1 FROM public.risk_disposable_email_domains d WHERE d.domain = email_domain) INTO is_disposable;
  IF is_disposable THEN s_i := s_i + 25; factors_i := factors_i || 'disposable_email'; END IF;
  IF age_seconds < 86400 * 30 THEN
    s_i := s_i + GREATEST(0, 15 * (1 - age_seconds / (86400 * 30)));
    IF age_seconds < 86400 THEN factors_i := factors_i || 'account_<24h_old'; END IF;
  END IF;
  s_i := LEAST(100, s_i);

  -- S2 Velocity
  SELECT min(created_at) INTO first_loan_at FROM public.loans WHERE borrower_user_id = p_user_id;
  IF first_loan_at IS NOT NULL THEN
    IF EXTRACT(EPOCH FROM (first_loan_at - u.created_at)) < 3600 THEN
      s_v := s_v + 35; factors_v := factors_v || 'first_loan_<1h_after_signup';
    ELSIF EXTRACT(EPOCH FROM (first_loan_at - u.created_at)) < 86400 THEN
      s_v := s_v + 20; factors_v := factors_v || 'first_loan_<24h_after_signup';
    END IF;
  END IF;
  SELECT count(*) INTO loans_24h FROM public.loans
   WHERE borrower_user_id = p_user_id AND created_at > now() - interval '24 hours';
  IF loans_24h >= 3 THEN s_v := s_v + 25; factors_v := factors_v || ('loans_24h=' || loans_24h); END IF;
  IF EXISTS (SELECT 1 FROM public.loans
              WHERE borrower_user_id = p_user_id
                AND referral_code_id IS NOT NULL
                AND created_at < u.created_at + interval '5 minutes') THEN
    s_v := s_v + 15; factors_v := factors_v || 'referral_used_<5min_after_signup';
  END IF;
  s_v := LEAST(100, s_v);

  -- S3 Repayment (rate-based)
  SELECT count(*) INTO total_loans FROM public.loans WHERE borrower_user_id = p_user_id;
  IF total_loans = 0 THEN
    s_r := 30; factors_r := factors_r || 'no_history';
  ELSE
    SELECT
      count(*) FILTER (WHERE repayment_status = 'Paid'    AND updated_at <= due_date),
      count(*) FILTER (WHERE repayment_status = 'Paid'    AND updated_at > due_date AND updated_at <= due_date + interval '7 days'),
      count(*) FILTER (WHERE repayment_status = 'Paid'    AND updated_at > due_date + interval '7 days'),
      count(*) FILTER (WHERE repayment_status = 'Unpaid'  AND due_date < now()),
      count(*) FILTER (WHERE repayment_status = 'Partial' AND due_date < now())
    INTO paid_on_time, paid_late, paid_very_late, overdue_now, partial
      FROM public.loans WHERE borrower_user_id = p_user_id;
    raw_r := 30
           + 80 * (overdue_now::numeric    / total_loans)
           + 60 * (paid_very_late::numeric / total_loans)
           + 25 * (paid_late::numeric      / total_loans)
           + 35 * (partial::numeric        / total_loans)
           - 35 * (paid_on_time::numeric   / total_loans);
    s_r := LEAST(100, GREATEST(0, raw_r));
    IF overdue_now    > 0 THEN factors_r := factors_r || ('overdue_now=' || overdue_now); END IF;
    IF paid_very_late > 0 THEN factors_r := factors_r || ('paid_very_late=' || paid_very_late); END IF;
    IF paid_late      > 0 THEN factors_r := factors_r || ('paid_late=' || paid_late); END IF;
    IF paid_on_time   > 0 THEN factors_r := factors_r || ('paid_on_time=' || paid_on_time); END IF;
  END IF;

  -- S4 Network (incl. SELF-LENDING DETECTION)
  IF u.chat_id IS NOT NULL THEN
    SELECT count(*) INTO shared_chat FROM public.users
     WHERE chat_id = u.chat_id AND id <> p_user_id;
    IF shared_chat > 0 THEN
      s_n := s_n + 35; factors_n := factors_n || ('shared_chat_id_with_' || shared_chat || '_users');
    END IF;
  END IF;
  IF u.email IS NOT NULL THEN
    email_prefix_norm := regexp_replace(split_part(split_part(lower(u.email),'@',1),'+',1),'\.','','g');
    SELECT count(*) INTO shared_email_pref FROM public.users o
     WHERE o.id <> p_user_id AND o.email IS NOT NULL
       AND regexp_replace(split_part(split_part(lower(o.email),'@',1),'+',1),'\.','','g') = email_prefix_norm
       AND split_part(lower(o.email),'@',2) = split_part(lower(u.email),'@',2);
    IF shared_email_pref > 0 THEN
      s_n := s_n + 20; factors_n := factors_n || 'shared_email_prefix';
    END IF;
  END IF;
  SELECT count(DISTINCT l.id) INTO bad_referral
    FROM public.loans my_loan
    JOIN public.loans l ON l.referral_code_id = my_loan.referral_code_id
   WHERE my_loan.borrower_user_id = p_user_id
     AND my_loan.referral_code_id IS NOT NULL
     AND l.borrower_user_id <> p_user_id
     AND l.repayment_status = 'Unpaid'
     AND l.due_date < now() - interval '14 days';
  IF bad_referral >= 3 THEN
    s_n := s_n + 30; factors_n := factors_n || ('referral_cluster_bad_loans=' || bad_referral);
  END IF;
  SELECT count(*) INTO reciprocity
    FROM public.loans a JOIN public.loans b
      ON a.lender_user_id = b.borrower_user_id
     AND a.borrower_user_id = b.lender_user_id
   WHERE a.borrower_user_id = p_user_id;
  IF reciprocity > 0 THEN
    s_n := s_n + 20; factors_n := factors_n || 'reciprocity_loop';
  END IF;

  -- N5a HARD self-lending: counterparty shares strong identifier
  SELECT count(DISTINCT counterparty_id) INTO self_lend_hard
  FROM (
    SELECT l.lender_user_id   AS counterparty_id FROM public.loans l
     WHERE l.borrower_user_id = p_user_id AND l.lender_user_id IS NOT NULL
    UNION
    SELECT l.borrower_user_id AS counterparty_id FROM public.loans l
     WHERE l.lender_user_id   = p_user_id AND l.borrower_user_id IS NOT NULL
  ) cp
  JOIN public.users o ON o.id = cp.counterparty_id
  WHERE o.id <> p_user_id
    AND ( (u.chat_id        IS NOT NULL AND o.chat_id        = u.chat_id)
       OR (u.telegram_id    IS NOT NULL AND o.telegram_id    = u.telegram_id)
       OR (u.google_id      IS NOT NULL AND o.google_id      = u.google_id)
       OR (u.wallet_address IS NOT NULL AND o.wallet_address = u.wallet_address)
       OR (u.nullifier_hash IS NOT NULL AND o.nullifier_hash = u.nullifier_hash)
       OR (u.email IS NOT NULL AND o.email IS NOT NULL
           AND regexp_replace(split_part(split_part(lower(o.email),'@',1),'+',1),'\.','','g')
             = regexp_replace(split_part(split_part(lower(u.email),'@',1),'+',1),'\.','','g')
           AND split_part(lower(o.email),'@',2) = split_part(lower(u.email),'@',2)) );
  IF self_lend_hard > 0 THEN
    s_n := s_n + 60; factors_n := factors_n || ('self_lending_hard_match=' || self_lend_hard || '_counterparty');
  END IF;

  -- N5b SOFT pair: both new (<14d), <1h signup delta
  SELECT count(DISTINCT cp.counterparty_id) INTO short_age_pair
  FROM (
    SELECT l.lender_user_id   AS counterparty_id FROM public.loans l WHERE l.borrower_user_id = p_user_id
    UNION ALL
    SELECT l.borrower_user_id AS counterparty_id FROM public.loans l WHERE l.lender_user_id   = p_user_id
  ) cp
  JOIN public.users o ON o.id = cp.counterparty_id
  WHERE o.id <> p_user_id
    AND age_seconds < 86400 * 14
    AND EXTRACT(EPOCH FROM (now() - o.created_at)) < 86400 * 14
    AND ABS(EXTRACT(EPOCH FROM (o.created_at - u.created_at))) < 3600;
  IF short_age_pair > 0 THEN
    s_n := s_n + 40; factors_n := factors_n || ('paired_new_account_<1h_signup_delta=' || short_age_pair);
  END IF;

  -- N5c CLUSTER: ≥3 short-lived accounts in chain
  WITH chain AS (
    SELECT DISTINCT counterparty_id FROM (
      SELECT l.lender_user_id   AS counterparty_id FROM public.loans l WHERE l.borrower_user_id = p_user_id
      UNION
      SELECT l.borrower_user_id AS counterparty_id FROM public.loans l WHERE l.lender_user_id   = p_user_id
    ) one_hop
    WHERE counterparty_id IS NOT NULL AND counterparty_id <> p_user_id
  )
  SELECT count(*) INTO cluster_size
  FROM chain c JOIN public.users o ON o.id = c.counterparty_id
  WHERE EXTRACT(EPOCH FROM (now() - o.created_at)) < 86400 * 14;
  IF cluster_size >= 2 AND age_seconds < 86400 * 14 THEN
    s_n := s_n + 35; factors_n := factors_n || ('sybil_cluster_size=' || (cluster_size + 1));
  END IF;

  s_n := LEAST(100, s_n);

  -- S5 Amount
  WITH first_loans AS (
    SELECT loan_amount, row_number() OVER (PARTITION BY borrower_user_id ORDER BY created_at) AS rn
      FROM public.loans WHERE borrower_user_id IS NOT NULL
  )
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY loan_amount) INTO median_request
    FROM first_loans WHERE rn = 1;
  median_request := COALESCE(NULLIF(median_request, 0), 50);
  SELECT loan_amount INTO recent_request FROM public.loans
   WHERE borrower_user_id = p_user_id ORDER BY created_at DESC LIMIT 1;
  IF recent_request IS NOT NULL THEN
    ratio := recent_request / median_request;
    IF age_seconds < 86400 * 7 THEN
      IF ratio > 1.5 THEN s_a := s_a + 30; factors_a := factors_a || 'new_account_amount_>1.5x_median'; END IF;
      IF ratio > 3.0 THEN s_a := s_a + 25; factors_a := factors_a || 'new_account_amount_>3x_median';   END IF;
    END IF;
  END IF;
  IF u.mal IS NOT NULL AND u.mal > 0 THEN
    utilization := COALESCE(u.nal,0)::numeric / u.mal;
    IF utilization >= 1.0 THEN s_a := s_a + 30; factors_a := factors_a || 'at_loan_limit'; END IF;
    IF utilization >= 0.66 AND utilization < 1.0 THEN s_a := s_a + 15; factors_a := factors_a || 'high_utilization'; END IF;
  END IF;
  s_a := LEAST(100, s_a);

  -- S6 Engagement
  SELECT count(*) INTO reminder_count FROM public.loan_notifications
   WHERE user_id = p_user_id AND notification_type IN ('urgent_reminder','final_reminder');
  IF reminder_count >= 3 THEN
    s_e := s_e + 25; factors_e := factors_e || ('chronic_delinquency_reminders=' || reminder_count);
  ELSIF reminder_count >= 1 THEN
    s_e := s_e + 12; factors_e := factors_e || ('delinquency_reminders=' || reminder_count);
  END IF;
  SELECT points_total INTO user_points_total FROM public.user_points WHERE user_id = p_user_id;
  IF user_points_total IS NULL OR user_points_total = 0 THEN
    s_e := s_e + 15; factors_e := factors_e || 'no_user_points';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.point_events WHERE user_id = p_user_id) INTO has_any_event;
  IF NOT has_any_event THEN
    s_e := s_e + 10; factors_e := factors_e || 'no_point_events_ever';
  END IF;
  IF u.credit_progression_paused IS TRUE THEN
    s_e := s_e + 30; factors_e := factors_e || 'credit_progression_paused';
  END IF;
  IF u.telegram_id IS NULL THEN
    s_e := s_e + 10; factors_e := factors_e || 'no_telegram_for_notifications';
  END IF;
  s_e := LEAST(100, s_e);

  -- S7 Behavioral pattern (bot-like)
  SELECT count(*) INTO total_user_loans FROM public.loans WHERE borrower_user_id = p_user_id;
  IF total_user_loans >= 3 THEN
    SELECT array_agg(diff_s ORDER BY ord) INTO request_intervals FROM (
      SELECT EXTRACT(EPOCH FROM (created_at - lag(created_at) OVER (ORDER BY created_at))) AS diff_s,
             row_number() OVER (ORDER BY created_at) AS ord
      FROM public.loans WHERE borrower_user_id = p_user_id
    ) sub WHERE diff_s IS NOT NULL;
    IF request_intervals IS NOT NULL AND array_length(request_intervals, 1) >= 2 THEN
      SELECT avg(v), stddev_samp(v) INTO interval_mean, interval_stddev FROM unnest(request_intervals) AS v;
      IF interval_mean > 0 AND (interval_stddev / interval_mean) < 0.1 THEN
        s_b := s_b + 35; factors_b := factors_b || 'request_intervals_too_uniform';
      ELSIF interval_mean > 0 AND (interval_stddev / interval_mean) < 0.25 THEN
        s_b := s_b + 18; factors_b := factors_b || 'request_intervals_suspiciously_uniform';
      END IF;
      IF interval_mean < 300 THEN
        s_b := s_b + 25; factors_b := factors_b || ('mean_request_interval_<5min=' || round(interval_mean)::int || 's');
      END IF;
    END IF;
  END IF;
  IF total_user_loans >= 3 THEN
    SELECT count(DISTINCT loan_amount)::numeric / total_user_loans INTO amount_uniqueness
      FROM public.loans WHERE borrower_user_id = p_user_id;
    IF amount_uniqueness <= 0.34 THEN
      s_b := s_b + 20; factors_b := factors_b || 'identical_loan_amounts';
    END IF;
    SELECT count(*) INTO round_amount_count FROM public.loans
     WHERE borrower_user_id = p_user_id AND loan_amount = round(loan_amount / 10) * 10;
    IF round_amount_count = total_user_loans THEN
      s_b := s_b + 8; factors_b := factors_b || 'all_amounts_round_numbers';
    END IF;
  END IF;
  SELECT count(*) INTO same_minute_count FROM (
    SELECT date_trunc('minute', created_at) AS m, count(*) AS c
      FROM public.loans WHERE borrower_user_id = p_user_id
     GROUP BY 1 HAVING count(*) > 1
  ) bursts;
  IF same_minute_count > 0 THEN
    s_b := s_b + 25; factors_b := factors_b || ('same_minute_loan_bursts=' || same_minute_count);
  END IF;
  user_modify_delta := EXTRACT(EPOCH FROM (COALESCE(u.updated_at, u.created_at) - u.created_at));
  IF user_modify_delta IS NOT NULL AND user_modify_delta < 1 AND age_seconds > 86400 THEN
    s_b := s_b + 12; factors_b := factors_b || 'profile_never_edited';
  END IF;
  s_b := LEAST(100, s_b);

  -- Consensus combine. Weights sum to 1.00.
  final_score := round(0.20*s_i + 0.16*s_v + 0.20*s_r + 0.14*s_n + 0.08*s_a + 0.08*s_e + 0.14*s_b)::int;
  IF s_r > 70 THEN final_score := GREATEST(final_score, round(s_r)::int + 10); END IF;
  IF overdue_now >= 2 THEN final_score := GREATEST(final_score, 60); END IF;
  final_score := GREATEST(0, LEAST(100, final_score));

  band := CASE
    WHEN final_score < 30 THEN 'Low'
    WHEN final_score < 55 THEN 'Medium'
    WHEN final_score < 75 THEN 'High'
    ELSE 'Critical'
  END;

  breakdown := jsonb_build_object(
    'I', jsonb_build_object('score', round(s_i)::int, 'weight', 0.20, 'factors', to_jsonb(factors_i)),
    'V', jsonb_build_object('score', round(s_v)::int, 'weight', 0.16, 'factors', to_jsonb(factors_v)),
    'R', jsonb_build_object('score', round(s_r)::int, 'weight', 0.20, 'factors', to_jsonb(factors_r)),
    'N', jsonb_build_object('score', round(s_n)::int, 'weight', 0.14, 'factors', to_jsonb(factors_n)),
    'A', jsonb_build_object('score', round(s_a)::int, 'weight', 0.08, 'factors', to_jsonb(factors_a)),
    'E', jsonb_build_object('score', round(s_e)::int, 'weight', 0.08, 'factors', to_jsonb(factors_e)),
    'B', jsonb_build_object('score', round(s_b)::int, 'weight', 0.14, 'factors', to_jsonb(factors_b))
  );

  INSERT INTO public.risk_scores (user_id, score, band, signal_breakdown, trigger)
  VALUES (p_user_id, final_score, band, breakdown, 'manual')
  RETURNING * INTO inserted;

  UPDATE public.users
     SET current_risk_score = final_score,
         current_risk_band  = band,
         risk_computed_at   = inserted.computed_at
   WHERE id = p_user_id;

  -- Mirror to admin_risk_profiles so the existing admin panel can read it.
  -- risk_level enum is low|medium|high; collapse Critical → high.
  IF to_regclass('public.admin_risk_profiles') IS NOT NULL THEN
    INSERT INTO public.admin_risk_profiles (
      user_id, score, risk_level, status,
      algorithm_version, algorithm_note, calculated_at
    )
    VALUES (
      p_user_id, final_score,
      CASE WHEN final_score < 30 THEN 'low'
           WHEN final_score < 55 THEN 'medium'
           ELSE 'high' END,
      'active',
      'consensus_v1',
      (SELECT string_agg(f, '; ') FROM (
         SELECT unnest(factors_i || factors_v || factors_r || factors_n || factors_a || factors_e || factors_b) AS f LIMIT 8
       ) top_factors),
      inserted.computed_at
    )
    ON CONFLICT (user_id) DO UPDATE
    SET score             = EXCLUDED.score,
        risk_level        = EXCLUDED.risk_level,
        algorithm_version = EXCLUDED.algorithm_version,
        algorithm_note    = EXCLUDED.algorithm_note,
        calculated_at     = EXCLUDED.calculated_at
    WHERE admin_risk_profiles.override_score IS NULL;
  END IF;

  RETURN inserted;
END;
$func$;

-- ---------- Triggers --------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_risk_recompute_for_loan()
RETURNS trigger LANGUAGE plpgsql AS $loan_trig$
BEGIN
  PERFORM pg_notify('risk_recompute',
    json_build_object('user_id', NEW.borrower_user_id, 'trigger', 'loan_request')::text);
  RETURN NEW;
END $loan_trig$;

CREATE OR REPLACE FUNCTION public.enqueue_risk_recompute_for_event()
RETURNS trigger LANGUAGE plpgsql AS $evt_trig$
BEGIN
  PERFORM pg_notify('risk_recompute',
    json_build_object('user_id', NEW.user_id, 'trigger', 'point_event')::text);
  RETURN NEW;
END $evt_trig$;

DROP TRIGGER IF EXISTS trg_risk_loan_request ON public.loans;
DROP TRIGGER IF EXISTS trg_risk_point_event  ON public.point_events;

CREATE TRIGGER trg_risk_loan_request
  AFTER INSERT OR UPDATE OF repayment_status, loan_status ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_risk_recompute_for_loan();

CREATE TRIGGER trg_risk_point_event
  AFTER INSERT ON public.point_events
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_risk_recompute_for_event();

-- New users get a baseline risk profile at signup.
CREATE OR REPLACE FUNCTION public.compute_risk_score_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $signup_trig$
BEGIN
  PERFORM public.compute_risk_score(NEW.id);
  UPDATE public.risk_scores SET trigger = 'signup'
   WHERE user_id = NEW.id
     AND id = (SELECT id FROM public.risk_scores WHERE user_id = NEW.id ORDER BY computed_at DESC LIMIT 1);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'compute_risk_score_on_signup failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $signup_trig$;

DROP TRIGGER IF EXISTS trg_risk_signup ON public.users;
CREATE TRIGGER trg_risk_signup
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.compute_risk_score_on_signup();

-- ---------- Permissions / RLS -----------------------------------
-- Function runs SECURITY DEFINER. Don't grant to anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.compute_risk_score(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.compute_risk_score(uuid) TO service_role;

ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS risk_scores_service_role ON public.risk_scores;
CREATE POLICY risk_scores_service_role ON public.risk_scores FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ---------- Daily batch (commented; enable explicitly) ----------
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'risk-score-daily',
--   '0 3 * * *',
--   $cron$ SELECT public.compute_risk_score(id) FROM public.users $cron$
-- );
