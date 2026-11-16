-- Fixes from the 2026-11-16 review of the Nov 15 PRs.
--
-- 1. Contact-lines rule (#1522) could be skipped: it trusted loans.market from the insert, which a hand-made
--    request can set to 'ID' (trg_set_loan_market runs after it and overwrites it, too late). The Indonesia
--    exemption now comes only from the account (users.market), which the function already reads.
--
-- 2. Two-payment loans (#1529): a late FIRST payment never counted as late. Everything that asks "overdue?"
--    or "on time?" goes through app_private.loan_past_due_at / is_loan_repaid_on_time, which only looked at
--    due_date (the last payment). Now:
--      * loan_past_due_at = the deadline of the next unpaid payment (end of that day in the loan's zone), so
--        has_overdue_loan pauses vouchers / affiliate payouts while payment 1 is late;
--      * repayment_schedule_late_at is stamped when a payment lands after its deadline (or a later payment
--        lands while an earlier one was late), and is_loan_repaid_on_time is false once it is set, so
--        streaks, Pandesal points and "on time" rewards don't count that loan.
--
-- 3. The schedule check now also enforces what the app builds: two equal parts (an odd cent allowed) and a
--    loan running at least 28 days (a day of slack for time zones).

-- ── 1 ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.enforce_loan_request_contact_lines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  u record;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR new.borrower_user_id IS NULL THEN
    RETURN new;
  END IF;
  IF new.borrower_user_id IN ('28cd3b3e-a975-48ab-9db3-a23f74c01d42'::uuid, 'a629dfa3-ebe0-4365-b267-294b19a6ead1'::uuid) THEN
    RETURN new;
  END IF;

  -- Indonesia track: read from the account only, never from the loan row the caller sent.
  SELECT messenger_psid, messenger_verified_at, whatsapp_verified_at, market
    INTO u
    FROM public.users WHERE id = new.borrower_user_id;
  IF NOT FOUND OR coalesce(u.market, '') = 'ID' THEN
    RETURN new;
  END IF;

  IF u.messenger_psid IS NULL OR u.messenger_verified_at IS NULL THEN
    RAISE EXCEPTION 'contact_lines_missing: connect Facebook Messenger (send the code) before requesting a loan'
      USING ERRCODE = 'P0001';
  END IF;
  IF u.whatsapp_verified_at IS NULL AND coalesce(public.get_whatsapp_reminders_enabled(), false) THEN
    RAISE EXCEPTION 'contact_lines_missing: confirm your WhatsApp before requesting a loan'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN new;
END;
$$;

-- ── 2 ─────────────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS repayment_schedule_late_at timestamptz;
COMMENT ON COLUMN public.loans.repayment_schedule_late_at IS
  'Two-payment loans: when a payment was first made after its deadline. Set by the server only; makes the loan not "on time".';

-- End of a calendar day in the loan's zone (same rule as loan_past_due_at).
CREATE OR REPLACE FUNCTION app_private.loan_day_end(p_day date, p_zone text)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  select (p_day + 1)::timestamp
    at time zone (case when app_private.is_usable_timezone(p_zone) then p_zone else 'Asia/Manila' end);
$$;

-- The deadline of the first payment not covered by `p_repaid`, or null (no schedule / all covered).
CREATE OR REPLACE FUNCTION app_private.loan_next_part_due_at(p_loan public.loans, p_repaid numeric)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $$
DECLARE
  part jsonb;
  cumulative numeric := 0;
BEGIN
  IF p_loan.repayment_schedule IS NULL OR jsonb_typeof(p_loan.repayment_schedule) <> 'array' THEN
    RETURN NULL;
  END IF;
  FOR part IN SELECT value FROM jsonb_array_elements(p_loan.repayment_schedule) LOOP
    cumulative := cumulative + coalesce((part ->> 'amount')::numeric, 0);
    IF coalesce(p_repaid, 0) + 0.005 < cumulative THEN
      RETURN app_private.loan_day_end((part ->> 'due')::date, p_loan.due_timezone);
    END IF;
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.loan_past_due_at(p_loan public.loans)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  select coalesce(
    app_private.loan_next_part_due_at(p_loan, p_loan.repaid_amount),
    app_private.loan_day_end((p_loan.due_date at time zone 'UTC')::date, p_loan.due_timezone)
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_loan_repaid_on_time(p_loan public.loans)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  select app_private.is_loan_fully_repaid(p_loan)
    and p_loan.repayment_schedule_late_at is null
    and coalesce(p_loan.repaid_at, p_loan.updated_at) < app_private.loan_past_due_at(p_loan);
$$;

-- A payment on a two-payment loan: if the part it had to cover was already past its deadline, stamp the loan
-- late (once). Clients can never set or clear the stamp.
CREATE OR REPLACE FUNCTION private.stamp_loan_schedule_late()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_deadline timestamptz;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    new.repayment_schedule_late_at := old.repayment_schedule_late_at;
  END IF;
  IF new.repayment_schedule IS NULL OR new.repayment_schedule_late_at IS NOT NULL THEN
    RETURN new;
  END IF;
  IF coalesce(new.repaid_amount, 0) <= coalesce(old.repaid_amount, 0)
     AND new.repayment_status IS NOT DISTINCT FROM old.repayment_status THEN
    RETURN new;
  END IF;
  -- The first part still open before this payment: was its deadline already gone?
  v_deadline := app_private.loan_next_part_due_at(old, old.repaid_amount);
  IF v_deadline IS NOT NULL AND now() >= v_deadline THEN
    new.repayment_schedule_late_at := now();
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS zz_stamp_loan_schedule_late ON public.loans;
CREATE TRIGGER zz_stamp_loan_schedule_late
  BEFORE UPDATE OF repaid_amount, repayment_status, repayment_schedule_late_at ON public.loans
  FOR EACH ROW EXECUTE FUNCTION private.stamp_loan_schedule_late();

REVOKE ALL ON FUNCTION app_private.loan_day_end(date, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.loan_next_part_due_at(public.loans, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION private.stamp_loan_schedule_late() FROM public, anon, authenticated;

-- ── 3 ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.enforce_loan_repayment_schedule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  s jsonb := new.repayment_schedule;
  part jsonb;
  prev_due date;
  part_due date;
  part_amount numeric;
  first_amount numeric;
  total numeric := 0;
  final_day date;
  start_day date;
  zone text := coalesce(nullif(new.due_timezone, ''), 'Asia/Manila');
BEGIN
  IF s IS NULL OR jsonb_typeof(s) = 'null' THEN
    new.repayment_schedule := NULL;
    RETURN new;
  END IF;
  IF tg_op = 'UPDATE'
     AND s IS NOT DISTINCT FROM old.repayment_schedule
     AND new.total_repayment_amount IS NOT DISTINCT FROM old.total_repayment_amount
     AND new.due_date IS NOT DISTINCT FROM old.due_date THEN
    RETURN new;
  END IF;

  IF jsonb_typeof(s) <> 'array' OR jsonb_array_length(s) <> 2 THEN
    RAISE EXCEPTION 'loans: a split repayment must have exactly 2 payments' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(new.loan_amount, 0) <= 60 THEN
    RAISE EXCEPTION 'loans: only loans over $60 can be paid back in 2 parts' USING ERRCODE = 'P0001';
  END IF;

  FOR part IN SELECT value FROM jsonb_array_elements(s) LOOP
    BEGIN
      part_due := (part ->> 'due')::date;
      part_amount := (part ->> 'amount')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'loans: each payment needs a due day and an amount' USING ERRCODE = 'P0001';
    END;
    IF part_due IS NULL OR part_amount IS NULL OR part_amount <= 0 OR part_amount <> round(part_amount, 2) THEN
      RAISE EXCEPTION 'loans: each payment needs a due day and an amount in whole cents' USING ERRCODE = 'P0001';
    END IF;
    IF prev_due IS NOT NULL AND part_due <= prev_due THEN
      RAISE EXCEPTION 'loans: payment dates must be in order' USING ERRCODE = 'P0001';
    END IF;
    IF first_amount IS NULL THEN
      first_amount := part_amount;
    ELSIF abs(part_amount - first_amount) > 0.011 THEN
      RAISE EXCEPTION 'loans: the 2 payments must be the same amount' USING ERRCODE = 'P0001';
    END IF;
    prev_due := part_due;
    total := total + part_amount;
  END LOOP;

  IF total <> new.total_repayment_amount THEN
    RAISE EXCEPTION 'loans: the payments ($%) must add up to the repayment total ($%)', round(total, 2), round(new.total_repayment_amount, 2)
      USING ERRCODE = 'P0001';
  END IF;

  final_day := (new.due_date AT TIME ZONE zone)::date;
  IF new.due_date IS NULL OR abs(prev_due - final_day) > 1 THEN
    RAISE EXCEPTION 'loans: the last payment must be due on the loan''s due date' USING ERRCODE = 'P0001';
  END IF;

  start_day := (coalesce(CASE WHEN tg_op = 'UPDATE' THEN old.created_at END, now()) AT TIME ZONE zone)::date;
  IF prev_due - start_day < 27 THEN
    RAISE EXCEPTION 'loans: a loan must run at least 28 days to be paid back in 2 parts' USING ERRCODE = 'P0001';
  END IF;

  RETURN new;
END;
$$;
