/**
 * Credit tier configuration constants
 * Used for credit limit calculations throughout the application
 */

export const CREDIT_TIER_INCREMENT = 20;
export const STARTING_CREDIT_LIMIT = 20;

/**
 * Calculate the credit tier key for a given loan amount
 * @param loanAmount - The loan amount
 * @returns The credit tier key (rounded down to nearest tier)
 */
export function getCreditTierKey(loanAmount: number): number {
   return Math.floor(loanAmount / CREDIT_TIER_INCREMENT) * CREDIT_TIER_INCREMENT;
}

/**
 * Calculate the remainder for a given loan amount against the tier
 * @param loanAmount - The loan amount
 * @returns The remainder when divided by tier increment
 */
export function getCreditTierRemainder(loanAmount: number): number {
   return loanAmount % CREDIT_TIER_INCREMENT;
}

/**
 * Check if a loan amount matches an exact credit tier
 * @param loanAmount - The loan amount
 * @returns True if the loan amount is exactly on a tier boundary
 */
export function isExactCreditTier(loanAmount: number): boolean {
   return getCreditTierRemainder(loanAmount) === 0;
}

/**
 * Get the next credit tier amount
 * @param currentAmount - The current loan amount
 * @returns The next tier amount
 */
export function getNextCreditTier(currentAmount: number): number {
   return getCreditTierKey(currentAmount) + CREDIT_TIER_INCREMENT;
}
