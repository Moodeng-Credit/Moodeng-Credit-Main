-- Affiliate codes pay $5 per friend who repays (was $10). Payouts already earned keep their amount.
alter table public.referral_codes alter column payout_amount set default 5;
update public.referral_codes set payout_amount = 5 where payout_amount = 10;
