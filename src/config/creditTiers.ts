/**
 * Credit tier configuration constants
 * Used for credit limit calculations throughout the application
 */

export const CREDIT_TIERS = [15, 20, 40, 60, 80, 100, 120, 140] as const;
export const STARTING_CREDIT_LIMIT = CREDIT_TIERS[0];
export const MAX_CREDIT_LIMIT = CREDIT_TIERS[CREDIT_TIERS.length - 1];

/**
 * Get the next credit tier amount
 * @param currentAmount - The current loan amount
 * @returns The next tier amount
 */
export function getNextCreditTier(currentAmount: number): number {
   const currentTierIndex = CREDIT_TIERS.findIndex((tier) => tier >= currentAmount);
   if (currentTierIndex < 0) return MAX_CREDIT_LIMIT;
   return CREDIT_TIERS[Math.min(currentTierIndex + 1, CREDIT_TIERS.length - 1)];
}

/**
 * Boosts a referral code may carry. A new borrower starts at STARTING_CREDIT_LIMIT and a boost lands
 * them at start + boost, which must be a credit level exactly, or the next level would skip one
 * (a $10 boost gives $25, and the next tier from $25 is $60). Matches the referral_codes check constraint.
 */
export const REFERRAL_BOOST_OPTIONS: readonly number[] = CREDIT_TIERS.slice(1).map((tier) => tier - STARTING_CREDIT_LIMIT);

export const isValidReferralBoost = (boost: number): boolean => REFERRAL_BOOST_OPTIONS.includes(boost);

export function getCreditLevelNumber(creditLimit: number): number {
   const tierIndex = CREDIT_TIERS.findIndex((tier) => tier >= creditLimit);
   return tierIndex >= 0 ? tierIndex + 1 : CREDIT_TIERS.length;
}
