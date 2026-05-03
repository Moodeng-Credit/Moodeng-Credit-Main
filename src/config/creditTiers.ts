/**
 * Credit tier configuration constants
 * Used for credit limit calculations throughout the application
 */

export const CREDIT_TIERS = [15, 20, 40, 60, 80, 100, 120, 140] as const;
export const STARTING_CREDIT_LIMIT = CREDIT_TIERS[0];
export const MAX_CREDIT_LIMIT = CREDIT_TIERS[CREDIT_TIERS.length - 1];
export const CREDIT_TIER_INCREMENT = 20;

/**
 * Calculate the credit tier key for a given loan amount
 * @param loanAmount - The loan amount
 * @returns The credit tier key (rounded down to nearest tier)
 */
export function getCreditTierKey(loanAmount: number): number {
   const matchingTier = [...CREDIT_TIERS].reverse().find((tier) => loanAmount >= tier);
   return matchingTier ?? 0;
}

/**
 * Calculate the remainder for a given loan amount against the tier
 * @param loanAmount - The loan amount
 * @returns The remainder when divided by tier increment
 */
export function getCreditTierRemainder(loanAmount: number): number {
   const tier = getCreditTierKey(loanAmount);
   return tier > 0 ? loanAmount - tier : loanAmount;
}

/**
 * Check if a loan amount matches an exact credit tier
 * @param loanAmount - The loan amount
 * @returns True if the loan amount is exactly on a tier boundary
 */
export function isExactCreditTier(loanAmount: number): boolean {
   return CREDIT_TIERS.includes(loanAmount as (typeof CREDIT_TIERS)[number]);
}

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

export function getCreditLevelNumber(creditLimit: number): number {
   const tierIndex = CREDIT_TIERS.findIndex((tier) => tier >= creditLimit);
   return tierIndex >= 0 ? tierIndex + 1 : CREDIT_TIERS.length;
}
