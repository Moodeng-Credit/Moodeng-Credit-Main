-- BitRepo credit line: never auto-link a loan under $15 (George, 2026-10-13). $15 is the smallest real
-- loan (Level 1); anything smaller from the facility lender's account is a test (e.g. a $1 test), and
-- it would skew the lender's report. Test loans were already skipped.

CREATE OR REPLACE FUNCTION app_private.link_credit_facility_loan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
   IF NEW.loan_status IS DISTINCT FROM 'Lent' OR NEW.funded_at IS NULL OR NEW.lender_user_id IS NULL OR coalesce(NEW.is_test, false)
      OR coalesce(NEW.loan_amount, 0) < 15 THEN
      RETURN NULL;
   END IF;
   IF TG_OP = 'UPDATE' AND OLD.loan_status = 'Lent' AND OLD.funded_at IS NOT NULL AND OLD.lender_user_id IS NOT DISTINCT FROM NEW.lender_user_id THEN
      RETURN NULL; -- already funded before this update
   END IF;
   BEGIN
      INSERT INTO public.credit_facility_loans (facility_id, loan_id, rationale)
      SELECT f.id, NEW.id, app_private.draft_facility_rationale(NEW.id)
        FROM public.credit_facilities f
       WHERE f.lender_user_id = NEW.lender_user_id
         AND (NEW.funded_at AT TIME ZONE 'Asia/Manila')::date >= f.start_date
       ORDER BY f.start_date DESC
       LIMIT 1
      ON CONFLICT DO NOTHING;
   EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'link_credit_facility_loan failed for %: %', NEW.id, SQLERRM;
   END;
   RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION app_private.link_credit_facility_loan() FROM PUBLIC, anon, authenticated;

-- Nothing under $15 or marked test stays linked.
DELETE FROM public.credit_facility_loans c
 USING public.loans l
 WHERE l.id = c.loan_id
   AND (coalesce(l.loan_amount, 0) < 15 OR coalesce(l.is_test, false));
