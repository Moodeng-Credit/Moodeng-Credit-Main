-- A referral code's boost must land the $15 starting limit exactly on a credit tier.
--
-- redeem_referral_code sets cs = least(cs + boost, 15 + boost) for a borrower at the start, and every
-- other place (limit checks, level cards, getNextCreditTier) assumes cs is one of the tiers
-- 15, 20, 40, 60, 80, 100, 120, 140. A boost like +10 gives $25, which is no tier: the next level would
-- then jump from $25 straight to $60, skipping $40. All live codes are +5 ($20), which passes.

alter table public.referral_codes
  add constraint referral_codes_boost_lands_on_tier
  check (boost_amount in (5, 25, 45, 65, 85, 105, 125));
