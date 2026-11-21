-- Affiliate-only sign-up (/partner links, 20261119240000_affiliate_invite_links): claim_affiliate_invite
-- sets user_role = 'affiliate', which the old check (borrower | lender) refused.
alter table public.users drop constraint if exists users_user_role_check;
alter table public.users add constraint users_user_role_check
  check (user_role is null or user_role = any (array['borrower'::text, 'lender'::text, 'affiliate'::text]));
