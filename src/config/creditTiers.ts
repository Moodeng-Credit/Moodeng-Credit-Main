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
 * The ladder before 2026-11-14 10:00 Bangkok: $15, $20, $40, $60 … Track A borrowers stay on it.
 */
export const OLD_CREDIT_TIERS: readonly number[] = [15, 20, 40, 60, 80, 100, 120, 140];
export const LADDER_SWITCH_AT = Date.parse('2026-11-14T10:00:00+07:00');

/**
 * Two tracks (George, 2026-11-22): borrowers who joined before October 2026 (Bangkok) are Track A and keep
 * the old ladder for good ($20 → $40 → $60 …). Everyone else is Track B: the new ladder, $10 a level, so a
 * Track B borrower still at an old limit goes $20 → $25, $40 → $45. Kept in sync with
 * supabase/functions/_shared/creditAndPoints.ts.
 */
export type CreditTrack = 'A' | 'B';
export const TRACK_A_JOINED_BEFORE = Date.parse('2026-10-01T00:00:00+07:00');

/** The borrower's track from when they joined (users.created_at). Unknown → Track B. */
export function getCreditTrack(joinedAt?: string | number | Date | null): CreditTrack {
   const joined = joinedAt == null ? Number.NaN : new Date(joinedAt).getTime();
   return Number.isFinite(joined) && joined < TRACK_A_JOINED_BEFORE ? 'A' : 'B';
}

export const creditLadderFor = (track: CreditTrack): readonly number[] => (track === 'A' ? OLD_CREDIT_TIERS : CREDIT_TIERS);

/**
 * The next limit after `currentAmount` on the borrower's track (pass users.created_at): B $20 → $25, A $20 → $40.
 * Pass the loan's `fundedAt` for a level-up: a Track B full-limit loan funded before the Nov 14 switch at an old
 * limit was promised the old step, so it still gets it once ($20 → $40); after that it's +$10 ($40 → $45).
 */
export function getNextCreditTier(
   currentAmount: number,
   joinedAt?: string | number | Date | null,
   fundedAt?: string | number | Date | null
): number {
   const funded = fundedAt == null ? Number.NaN : new Date(fundedAt).getTime();
   const promisedOldStep = Number.isFinite(funded) && funded < LADDER_SWITCH_AT && !CREDIT_TIERS.includes(currentAmount);
   const ladder = promisedOldStep ? OLD_CREDIT_TIERS : creditLadderFor(getCreditTrack(joinedAt));
   const next = ladder.find((tier) => tier > currentAmount);
   return Math.min(next ?? MAX_CREDIT_LIMIT, MAX_CREDIT_LIMIT);
}

/** The step a past full-limit loan unlocked, by when it was repaid: before the switch, the old ladder. */
export function getPastNextCreditTier(
   limitBefore: number,
   repaidAt?: string | number | Date | null,
   joinedAt?: string | number | Date | null
): number {
   const repaid = repaidAt == null ? Number.NaN : new Date(repaidAt).getTime();
   const oldIndex = OLD_CREDIT_TIERS.indexOf(limitBefore);
   if (Number.isFinite(repaid) && repaid < LADDER_SWITCH_AT && oldIndex >= 0 && oldIndex < OLD_CREDIT_TIERS.length - 1) {
      return OLD_CREDIT_TIERS[oldIndex + 1];
   }
   return getNextCreditTier(limitBefore, joinedAt);
}

/** Level number for a limit: its place on the ladder, rounded up for a limit between levels ($20 = level 2). */
export function getCreditLevelNumber(creditLimit: number, track: CreditTrack = 'B'): number {
   const ladder = creditLadderFor(track);
   const tierIndex = ladder.findIndex((tier) => tier >= creditLimit);
   return tierIndex >= 0 ? tierIndex + 1 : ladder.length;
}

/** The levels to show a borrower: the ones they have, then the next `ahead`. Never the whole ladder. */
export function visibleCreditTiers(currentLimit: number, ahead = 2, track: CreditTrack = 'B'): number[] {
   const ladder = creditLadderFor(track).filter((tier) => tier <= MAX_CREDIT_LIMIT);
   const next = ladder.filter((tier) => tier > currentLimit).slice(0, ahead);
   return [...ladder.filter((tier) => tier <= currentLimit), ...next];
}
