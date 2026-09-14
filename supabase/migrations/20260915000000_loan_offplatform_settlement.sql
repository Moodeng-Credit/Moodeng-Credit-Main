-- Off-platform settlement (display-only) --------------------------------------------------------
--
-- Some loans are refunded to the lender by the platform (refunded_at set, lender made whole) and the
-- borrower is then pursued off-platform. Occasionally the borrower ultimately settles that debt
-- off-platform (e.g. after an extended deadline). When that happens we want the LENDER-FACING status
-- to read as REPAID (the debt came good and they were made whole), while the loan stays a refund for
-- ALL internal accounting.
--
-- IMPORTANT: this is a DISPLAY-ONLY signal. It intentionally does NOT touch refunded_at, so every
-- credit / earnings / trust / milestone calculation (all of which key off `refunded_at is null`)
-- continues to exclude this loan exactly as before. A refund is still never counted as a borrower
-- repayment anywhere in those surfaces.
alter table public.loans
   add column if not exists offplatform_settled_at    timestamptz,
   add column if not exists offplatform_settlement_note text,
   add column if not exists offplatform_settled_by     uuid;

comment on column public.loans.offplatform_settled_at is
   'Admin-recorded: when the borrower settled this (refunded) loan off-platform. DISPLAY-ONLY — flips the lender-facing status to REPAID. Never affects refunded_at or any credit/earnings/trust logic.';
comment on column public.loans.offplatform_settlement_note is
   'Admin note describing how the off-platform settlement was resolved / the money recovered.';
comment on column public.loans.offplatform_settled_by is
   'admin_users.id (or auth user id) of the admin who recorded the off-platform settlement.';
