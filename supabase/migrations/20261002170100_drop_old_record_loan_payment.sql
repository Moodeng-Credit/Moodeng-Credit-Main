-- confirm-loan-payment now calls record_loan_payment(…, p_spend_hashes text[], p_record_hash text, …).
drop function if exists public.record_loan_payment(uuid, text, uuid, text, text, bigint, text);
