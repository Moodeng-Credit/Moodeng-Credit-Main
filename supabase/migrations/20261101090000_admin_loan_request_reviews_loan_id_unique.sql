-- The admin Requests panel saves reviews with upsert(..., { onConflict: 'loan_id' }). The original
-- index was partial (WHERE loan_id IS NOT NULL), and Postgres can't match a partial index to a bare
-- ON CONFLICT (loan_id), so every "Flag for removal review" / "Reviewed, keep visible" click failed
-- with "no unique or exclusion constraint matching the ON CONFLICT specification".
-- A plain unique index still allows many NULL loan_ids, so nothing else changes.
drop index if exists public.admin_loan_request_reviews_loan_id_key;
create unique index if not exists admin_loan_request_reviews_loan_id_key
  on public.admin_loan_request_reviews (loan_id);
