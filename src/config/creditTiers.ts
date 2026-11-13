/**
 * The credit ladder: $15, $25, $35, $45 … — every level adds $10.
 * Kept in sync with supabase/functions/_shared/creditAndPoints.ts and _shared/trustPointRewards.ts
 * (src/test/creditLeveling.test.ts checks they match).
 *
 * The top limit is real but never named to borrowers: copy says "each full-limit loan adds $10", never
 * "up to $X". Raise MAX_CREDIT_LIMIT and the copies to grow it. Above $140 the database clamp in
 * enforce_borrower_credit_limits / record_loan_payment / bot_request_id_loan / apply_idr_peg_on_repayment
 * has to move too.
 */

export const STARTING_CREDIT_LIMIT = 15;
export const CREDIT_STEP = 10;
export const MAX_CREDIT_LIMIT = 135;

export const CREDIT_TIERS: readonly number[] = Array.from(
   { length: (MAX_CREDIT_LIMIT - STARTING_CREDIT_LIMIT) / CREDIT_STEP + 1 },
   (_, i) => STARTING_CREDIT_LIMIT + i * CREDIT_STEP
);

/**
 * The ladder before 2026-11-15. Borrowers who were on it keep their limit ($20, $40 …). A full-limit loan
 * funded before LADDER_SWITCH_AT was promised the old next step, so it still pays out that step.
 */
export const OLD_CREDIT_TIERS: readonly number[] = [15, 20, 40, 60, 80, 100, 120, 140];
export const LADDER_SWITCH_AT = Date.parse('2026-11-15T00:00:00+07:00');

/**
 * The next limit after `currentAmount`: the first ladder amount above it ($20 → $25, $25 → $35).
 * Pass the loan's `fundedAt` when it's a level-up for a loan: one funded before the switch at an old
 * limit gets the old next step ($20 → $40).
 */
export function getNextCreditTier(currentAmount: number, fundedAt?: string | number | Date | null): number {
   const funded = fundedAt == null ? Number.NaN : new Date(fundedAt).getTime();
   if (Number.isFinite(funded) && funded < LADDER_SWITCH_AT && !CREDIT_TIERS.includes(currentAmount)) {
      const oldIndex = OLD_CREDIT_TIERS.indexOf(currentAmount);
      if (oldIndex >= 0 && oldIndex < OLD_CREDIT_TIERS.length - 1) return Math.min(OLD_CREDIT_TIERS[oldIndex + 1], MAX_CREDIT_LIMIT);
   }
   return CREDIT_TIERS.find((tier) => tier > currentAmount) ?? MAX_CREDIT_LIMIT;
}

/** The step a past full-limit loan unlocked, by when it was repaid: before the switch, the old ladder. */
export function getPastNextCreditTier(limitBefore: number, repaidAt?: string | number | Date | null): number {
   const repaid = repaidAt == null ? Number.NaN : new Date(repaidAt).getTime();
   const oldIndex = OLD_CREDIT_TIERS.indexOf(limitBefore);
   if (Number.isFinite(repaid) && repaid < LADDER_SWITCH_AT && oldIndex >= 0 && oldIndex < OLD_CREDIT_TIERS.length - 1) {
      return OLD_CREDIT_TIERS[oldIndex + 1];
   }
   return getNextCreditTier(limitBefore);
}

/** Level number for a limit: its place on the ladder, rounded up for a limit between levels ($20 = level 2). */
export function getCreditLevelNumber(creditLimit: number): number {
   const tierIndex = CREDIT_TIERS.findIndex((tier) => tier >= creditLimit);
   return tierIndex >= 0 ? tierIndex + 1 : CREDIT_TIERS.length;
}

/** The levels to show a borrower: the ones they have, then the next `ahead`. Never the whole ladder. */
export function visibleCreditTiers(currentLimit: number, ahead = 2): number[] {
   const next = CREDIT_TIERS.filter((tier) => tier > currentLimit).slice(0, ahead);
   return [...CREDIT_TIERS.filter((tier) => tier <= currentLimit), ...next];
}
