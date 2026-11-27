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

/**
 * Income ladders (George, 2026-11-27: "connect their income to the credit ladder"). Low or no income
 * (income ceiling $35, app_private.limit_ceiling) climbs by a Limit Spin (+$2 to +$5, usually +$2), and their
 * repayment counts from day 7 of the loan (LOW_INCOME_COUNTS_AFTER_DAYS) instead of the 2nd half, since
 * they get paid weekly or irregularly ("they will probably repay after a week or so"). Everyone
 * else keeps the normal $10 steps. Every ladder stops at the borrower's ceiling ($60 by default, $140 with
 * team-approved proof of ₱23k+/month). Borrowers only ever see their own next number, never the tiers.
 * The $5 steps apply to Track B loans funded from INCOME_LADDER_FROM (and to "what's next" when no loan is
 * out); a loan already running keeps the step it was shown, capped at the ceiling. Never lowers a limit.
 * Kept in sync between src/config/creditTiers.ts and supabase/functions/_shared/creditAndPoints.ts.
 */
export const INCOME_LADDER_FROM = Date.parse('2026-11-28T00:00:00+07:00');
export const LOW_INCOME_CEILING = 35;
export const LOW_INCOME_LADDER: readonly number[] = [15, 18, 21, 24, 27, 30, 33, 35];
export const LOW_INCOME_COUNTS_AFTER_DAYS = 7;

/**
 * Limit Spin (George, 2026-11-27): low-income borrowers repay after about a week anyway, so each repayment
 * that counts (from day 7) earns a spin instead of a fixed step: at least +$2, usually +$3, never past
 * their ceiling. The server draws it (_shared/repaymentFollowUps.ts) and saves it in limit_boost_spins; the
 * app's wheel only lands on the result. The app shows the guaranteed minimum as "$17+".
 */
export const LOW_INCOME_MIN_STEP = 2;
export const LIMIT_SPIN_ODDS: ReadonlyArray<{ amount: number; weight: number }> = [
   // George 2026-11-28: most spins win +$1 on top of the $2 (+$3); +$5 stays a small chance.
   { amount: 2, weight: 25 },
   { amount: 3, weight: 60 },
   { amount: 4, weight: 10 },
   { amount: 5, weight: 5 }
];
export const drawLimitSpin = (rng: () => number = Math.random): number => {
   const total = LIMIT_SPIN_ODDS.reduce((sum, odd) => sum + odd.weight, 0);
   let roll = rng() * total;
   for (const odd of LIMIT_SPIN_ODDS) {
      if (roll < odd.weight) return odd.amount;
      roll -= odd.weight;
   }
   return LOW_INCOME_MIN_STEP;
};

/** On the low-income ladder ($3 steps, counts from day 7): income ceiling $35 and Track B. */
export const isLowIncomeLadder = (ceiling: number | null | undefined, joinedAt?: string | number | Date | null): boolean =>
   Boolean(ceiling) && (ceiling as number) <= LOW_INCOME_CEILING && getCreditTrack(joinedAt) === 'B';

/** The next limit after a full-limit loan, on the borrower's income ladder and never past their ceiling. */
export const getIncomeNextLimit = (
   currentAmount: number,
   ceiling: number | null | undefined,
   joinedAt?: string | number | Date | null,
   fundedAt?: string | number | Date | null
): number => {
   const trackNext = getNextCreditTier(currentAmount, joinedAt, fundedAt);
   if (!ceiling || !Number.isFinite(ceiling) || ceiling <= 0) return trackNext;
   const funded = fundedAt == null ? Number.NaN : new Date(fundedAt).getTime();
   const smallSteps =
      ceiling <= LOW_INCOME_CEILING && getCreditTrack(joinedAt) === 'B' && (!Number.isFinite(funded) || funded >= INCOME_LADDER_FROM);
   // Low income: the Limit Spin's guaranteed minimum (+$2); the spin can add up to $3 more.
   const next = smallSteps ? currentAmount + LOW_INCOME_MIN_STEP : trackNext;
   return Math.max(currentAmount, Math.min(next, ceiling, MAX_CREDIT_LIMIT));
};

/** This loan's counted repayment earns a Limit Spin (low income, Track B, funded from INCOME_LADDER_FROM). */
export const earnsLimitSpin = (
   ceiling: number | null | undefined,
   joinedAt?: string | number | Date | null,
   fundedAt?: string | number | Date | null
): boolean => {
   const funded = fundedAt == null ? Number.NaN : new Date(fundedAt).getTime();
   return (
      Boolean(ceiling) &&
      (ceiling as number) <= LOW_INCOME_CEILING &&
      getCreditTrack(joinedAt) === 'B' &&
      Number.isFinite(funded) &&
      funded >= INCOME_LADDER_FROM
   );
};

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
