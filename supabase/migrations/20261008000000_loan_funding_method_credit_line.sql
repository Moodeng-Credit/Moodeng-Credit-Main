-- Credit-line funding: loans Moodeng funds out of an outside credit line (e.g. the Bitrepo
-- facility) are tagged funding_method = 'credit_line', so credit-line usage can be totalled
-- straight from loans. Like 'direct', these never produce a sellable Loan Note.
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_funding_method_check;
ALTER TABLE public.loans
  ADD CONSTRAINT loans_funding_method_check
  CHECK (funding_method IN ('direct', 'smart_contract', 'credit_line'));

COMMENT ON COLUMN public.loans.funding_method IS
  'How the loan was funded: direct (wallet-to-wallet), smart_contract (LoanManager / Loan Note), or credit_line (Moodeng-funded from an outside credit line). NULL = legacy direct lend.';
