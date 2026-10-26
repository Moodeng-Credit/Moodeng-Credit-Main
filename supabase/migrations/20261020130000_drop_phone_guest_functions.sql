-- Phone sign-up texts a code since #1229, so the no-code phone guest from 20261019160000 is gone and
-- nothing calls these any more. phone_has_account was open to anon, so anyone could ask whether a
-- number has an account: drop it rather than leave it lying around. ph_mobile_digits was their helper.
DROP FUNCTION IF EXISTS public.claim_guest_phone(text);
DROP FUNCTION IF EXISTS public.phone_has_account(text);
DROP FUNCTION IF EXISTS public.ph_mobile_digits(text);
