-- Stableyard QR payouts are funded through a checkout option (Base USDC deposit address). After the
-- borrower sends, we must report their transaction with the option's id and the Payment's checkout
-- client secret, so both are kept with the quote. The secret only works for that one Payment.
alter table public.stableyard_qr_quotes
   add column if not exists option_id text,
   add column if not exists checkout_secret text;

comment on column public.stableyard_qr_quotes.option_id is
   'Stableyard checkout option the payout is funded through (null for payouts that got a deposit address directly).';
comment on column public.stableyard_qr_quotes.checkout_secret is
   'Checkout client secret of this one Payment, used to report the funding transaction.';
