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

export function getCreditLevelNumber(creditLimit: number): number {
   const tierIndex = CREDIT_TIERS.findIndex((tier) => tier >= creditLimit);
   return tierIndex >= 0 ? tierIndex + 1 : CREDIT_TIERS.length;
}
