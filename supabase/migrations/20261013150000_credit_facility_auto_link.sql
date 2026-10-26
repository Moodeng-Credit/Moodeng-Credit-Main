-- BitRepo credit line: every loan the facility's lender account funds is added to the facility by
-- itself, with a drafted "why approved", so the admin page, moodeng.app/creditline and its Excel stay
-- current without anyone tagging loans by hand. (Until now loans were linked manually, and two loans
-- funded on 2026-10-13 were missing.) The team can still edit the rationale or unlink a loan in admin.
--
--   credit_facilities.lender_user_id  — the Moodeng account that lends the facility's money (George's
--                                       direct-lend account for the BitRepo pilot).
--   app_private.draft_facility_rationale(loan) — the same facts the team wrote by hand: loan number and
--                                       repayment record, ID / liveness / Facebook / call checks, job,
--                                       income and purpose.
--   trigger zz_link_credit_facility_loan — on funding (loan_status → 'Lent' with funded_at), links the
--                                       loan to the facility whose lender funded it, on or after its
--                                       start date. Never blocks funding: any error is only logged.

ALTER TABLE public.credit_facilities ADD COLUMN IF NOT EXISTS lender_user_id uuid REFERENCES public.users(id);

UPDATE public.credit_facilities
   SET lender_user_id = '2371a419-4344-4f28-b580-19933e3d663f'
 WHERE name = 'BitRepo pilot' AND lender_user_id IS NULL;

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.draft_facility_rationale(p_loan_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
   l public.loans%ROWTYPE;
   u public.users%ROWTYPE;
   v_doc text;
   v_state text;
   v_prior int;
   v_repaid int;
   v_late int;
   v_parts text[] := ARRAY[]::text[];
   v_checks text[] := ARRAY[]::text[];
   v_income text;
BEGIN
   SELECT * INTO l FROM public.loans WHERE id = p_loan_id;
   IF NOT FOUND THEN RETURN NULL; END IF;
   SELECT * INTO u FROM public.users WHERE id = l.borrower_user_id;
   SELECT document_type, issuing_state INTO v_doc, v_state
     FROM public.kyc_identities WHERE user_id = l.borrower_user_id AND document_type IS NOT NULL
    ORDER BY fetched_at DESC NULLS LAST LIMIT 1;

   SELECT count(*),
          count(*) FILTER (WHERE p.repayment_status = 'Paid'),
          count(*) FILTER (WHERE p.repayment_status = 'Paid' AND p.repaid_at > p.due_date + interval '1 day')
     INTO v_prior, v_repaid, v_late
     FROM public.loans p
    WHERE p.borrower_user_id = l.borrower_user_id
      AND p.id <> l.id
      AND p.loan_status = 'Lent'
      AND p.funded_at < l.funded_at
      AND NOT coalesce(p.is_test, false);

   v_parts := v_parts || CASE
      WHEN v_prior = 0 THEN '1st loan.'
      ELSE format('Loan #%s; %s prior repaid%s.', v_prior + 1, v_repaid, CASE WHEN v_late > 0 THEN format(' (%s late)', v_late) ELSE ' on time' END)
   END;

   IF u.is_didit = 'ACTIVE' THEN
      v_checks := v_checks || ('Didit ID passed' || CASE WHEN v_doc IS NOT NULL THEN format(' (%s%s)', v_doc, CASE WHEN v_state IS NOT NULL THEN ', ' || v_state ELSE '' END) ELSE '' END);
   ELSIF u.is_world_id = 'ACTIVE' THEN
      v_checks := v_checks || 'World ID verified'::text;
   ELSE
      v_checks := v_checks || 'ID not verified'::text;
   END IF;
   IF u.liveness_status = 'APPROVED' THEN v_checks := v_checks || 'liveness passed'::text; END IF;
   IF u.messenger_verified_at IS NOT NULL THEN v_checks := v_checks || 'Facebook verified'::text; END IF;
   IF u.video_call_outcome = 'attended' THEN v_checks := v_checks || 'video call attended'::text; END IF;
   v_parts := v_parts || (array_to_string(v_checks, '; ') || '.');

   IF nullif(trim(u.profession), '') IS NOT NULL OR nullif(trim(u.income_type), '') IS NOT NULL THEN
      -- "teacher (full-time)", or just "full-time" when there's no job title.
      v_parts := v_parts || format('Job: %s.', CASE
         WHEN nullif(trim(u.profession), '') IS NULL THEN trim(u.income_type)
         ELSE concat_ws(' ', trim(u.profession), CASE WHEN nullif(trim(u.income_type), '') IS NOT NULL THEN '(' || trim(u.income_type) || ')' END)
      END);
   END IF;
   IF nullif(trim(u.monthly_income), '') IS NOT NULL THEN
      -- '400_700' → '$400–700', '700_plus' → '$700+', 'under_200' → 'under $200'
      v_income := CASE
         WHEN u.monthly_income ~ '^under_' THEN 'under $' || substr(u.monthly_income, 7)
         WHEN u.monthly_income ~ '_plus$' THEN '$' || replace(u.monthly_income, '_plus', '+')
         ELSE '$' || replace(u.monthly_income, '_', '–')
      END;
      v_parts := v_parts || format('Income: %s/mo.', v_income);
   END IF;
   IF nullif(trim(l.reason), '') IS NOT NULL THEN
      v_parts := v_parts || format('Purpose: %s', left(trim(l.reason), 160) || CASE WHEN length(trim(l.reason)) > 160 THEN '…' ELSE '' END);
   END IF;

   RETURN array_to_string(v_parts, ' ');
END;
$$;

REVOKE ALL ON FUNCTION app_private.draft_facility_rationale(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app_private.link_credit_facility_loan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
   IF NEW.loan_status IS DISTINCT FROM 'Lent' OR NEW.funded_at IS NULL OR NEW.lender_user_id IS NULL OR coalesce(NEW.is_test, false) THEN
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

DROP TRIGGER IF EXISTS zz_link_credit_facility_loan ON public.loans;
CREATE TRIGGER zz_link_credit_facility_loan
   AFTER INSERT OR UPDATE OF loan_status, funded_at, lender_user_id ON public.loans
   FOR EACH ROW EXECUTE FUNCTION app_private.link_credit_facility_loan();

-- Backfill: the facility lender's funded loans since the start that nobody linked yet.
INSERT INTO public.credit_facility_loans (facility_id, loan_id, rationale)
SELECT f.id, l.id, app_private.draft_facility_rationale(l.id)
  FROM public.credit_facilities f
  JOIN public.loans l ON l.lender_user_id = f.lender_user_id
 WHERE l.loan_status = 'Lent'
   AND l.funded_at IS NOT NULL
   AND NOT coalesce(l.is_test, false)
   AND (l.funded_at AT TIME ZONE 'Asia/Manila')::date >= f.start_date
ON CONFLICT DO NOTHING;
