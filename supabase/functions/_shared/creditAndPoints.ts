// Server-side port of the credit-progression + funding-points math that used to run client-side
// in src/store/slices/loanSlice.ts. Kept in sync with:
//   - src/lib/creditLeveling.ts        (evaluateCreditProgression, getEffectiveCreditLimit)
//   - src/config/creditTiers.ts        (CREDIT_TIERS, getNextCreditTier)
//   - src/shared/points.ts             (computeYearOneIouPointsDelta, getYearOneIouBorrowerBonusPoints)
//   - src/utils/decimalHelpers.ts      (toNumber)
//   - src/utils/dateFormatters.ts      (parseDateSafely)
// If any of those change, change this too. These are pure functions — no Supabase/Deno deps — so
// they can be unit-tested in isolation.

import { DEFAULT_TIMEZONE, isUsableTimezone, pastDueAt } from './loanDeadline.ts';

// --- small utils (ported) ---------------------------------------------------------------------

export const toNumber = (value: number | string | null | undefined): number => {
   if (value === null || value === undefined) return 0;
   if (typeof value === 'number') return value;
   const parsed = Number(value);
   return Number.isNaN(parsed) ? 0 : parsed;
};

export const parseDateSafely = (dateValue: string | Date): Date => {
   if (dateValue instanceof Date) return dateValue;
   const date = new Date(dateValue);
   return Number.isNaN(date.getTime()) ? new Date() : date;
};

// Kept in sync with src/lib/creditLeveling.ts isRepaidOnTime: on time = paid before the end of the
// due day on the borrower's clock (the loan's saved zone, else Manila). Same as pastDueAt.
export const isRepaidOnTime = (paidAt: string | Date, dueDate: string | Date, dueTimezone?: string | null): boolean =>
   parseDateSafely(paidAt).getTime() <
   pastDueAt(parseDateSafely(dueDate), isUsableTimezone(dueTimezone) ? dueTimezone : DEFAULT_TIMEZONE).getTime();

// --- credit tiers (ported from src/config/creditTiers.ts) --------------------------------------

// $15, $25, $35, $45 … (+$10 a level), top $135 (never named to borrowers).
export const STARTING_CREDIT_LIMIT = 15;
export const CREDIT_STEP = 10;
export const MAX_CREDIT_LIMIT = 135;
export const CREDIT_TIERS: readonly number[] = Array.from(
   { length: (MAX_CREDIT_LIMIT - STARTING_CREDIT_LIMIT) / CREDIT_STEP + 1 },
   (_, i) => STARTING_CREDIT_LIMIT + i * CREDIT_STEP
);

// The ladder before 2026-11-14 10:00 Bangkok: a full-limit loan funded before the switch at an old limit ($20, $40 …)
// was promised the old next step, so it still gets it.
export const OLD_CREDIT_TIERS: readonly number[] = [15, 20, 40, 60, 80, 100, 120, 140];
export const LADDER_SWITCH_AT = Date.parse('2026-11-14T10:00:00+07:00');

export const getNextCreditTier = (currentAmount: number, fundedAt?: string | number | Date | null): number => {
   const funded = fundedAt == null ? Number.NaN : new Date(fundedAt).getTime();
   if (Number.isFinite(funded) && funded < LADDER_SWITCH_AT && !CREDIT_TIERS.includes(currentAmount)) {
      const oldIndex = OLD_CREDIT_TIERS.indexOf(currentAmount);
      if (oldIndex >= 0 && oldIndex < OLD_CREDIT_TIERS.length - 1) return Math.min(OLD_CREDIT_TIERS[oldIndex + 1], MAX_CREDIT_LIMIT);
   }
   return CREDIT_TIERS.find((tier) => tier > currentAmount) ?? MAX_CREDIT_LIMIT;
};

// Admin "one level up / down" (Directory card): the next ladder step above or below the current
// limit, clamped to $15–$135. An off-ladder limit (old $20/$40 …) snaps to the nearest step in that
// direction. Returns the current limit when already at the end of the ladder.
export const shiftCreditLevel = (cs: number | null | undefined, direction: 'up' | 'down'): number => {
   const current = Math.min(Math.max(Number(cs ?? 0) || 0, STARTING_CREDIT_LIMIT), MAX_CREDIT_LIMIT);
   if (direction === 'up') return CREDIT_TIERS.find((tier) => tier > current) ?? current;
   return [...CREDIT_TIERS].reverse().find((tier) => tier < current) ?? current;
};

// --- credit progression (ported from src/lib/creditLeveling.ts) --------------------------------

export const getEffectiveCreditLimit = (cs: number | null | undefined, isVerified: boolean): number => {
   if (!isVerified) return 0;
   return Math.min(Math.max(toNumber(cs ?? 0), STARTING_CREDIT_LIMIT), MAX_CREDIT_LIMIT);
};

type CreditProgressionInput = {
   currentLimit: number | null | undefined;
   isVerified: boolean;
   repaidAmount: number | null | undefined;
   totalRepaymentAmount: number | null | undefined;
   /** Principal the borrower requested on the loan just repaid (not the repayment total). */
   loanAmount: number | null | undefined;
   dueDate: string;
   /** The loan's saved zone (`loans.due_timezone`); Manila when missing. */
   dueTimezone?: string | null;
   paidAt: string;
   /** When the loan was funded: one funded before the ladder switch keeps the old next step. */
   fundedAt?: string | null;
};

type CreditProgressionResult = {
   shouldLevelUp: boolean;
   nextLimit: number;
   isLate: boolean;
   isFullyRepaid: boolean;
};

export const evaluateCreditProgression = ({
   currentLimit,
   isVerified,
   repaidAmount,
   totalRepaymentAmount,
   loanAmount,
   dueDate,
   dueTimezone,
   paidAt,
   fundedAt
}: CreditProgressionInput): CreditProgressionResult => {
   const normalizedLimit = getEffectiveCreditLimit(currentLimit, isVerified);
   const repaid = toNumber(repaidAmount ?? 0);
   const totalRepayment = toNumber(totalRepaymentAmount ?? 0);
   const principal = toNumber(loanAmount ?? 0);
   const isFullyRepaid = totalRepayment > 0 && repaid >= totalRepayment;
   const isLate = !isRepaidOnTime(paidAt, dueDate, dueTimezone);
   // Only a full-limit loan levels you up: request at least your current limit, then repay it in full.
   // A smaller request is a trust-building loan and never levels up, even when principal + interest
   // reaches the limit or several small loans add up to it. Lateness doesn't block it: most late
   // repayments are tech trouble (wallets, exchanges), not the borrower's fault.
   const isFullLimitLoan = principal >= normalizedLimit;
   const canLevelUp = isVerified && isFullyRepaid && isFullLimitLoan && normalizedLimit < MAX_CREDIT_LIMIT;

   return {
      shouldLevelUp: canLevelUp,
      nextLimit: getNextCreditTier(normalizedLimit, fundedAt),
      isLate,
      isFullyRepaid
   };
};

// --- funding points (ported from src/shared/points.ts) -----------------------------------------

const POINTS_SCALE = 6;
const LOAN_FUNDING_POINTS_MULTIPLIER = 1n;
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

const parseAmountToMinorUnits = (amount: string | number): bigint => {
   const normalized = typeof amount === 'number' ? amount.toString() : amount.trim();
   if (normalized.length === 0 || normalized.includes('e') || normalized.includes('E')) {
      throw new Error('Loan amount must be a base-10 number');
   }
   if (!DECIMAL_PATTERN.test(normalized)) {
      throw new Error('Loan amount must be a positive number');
   }
   const [whole, fraction = ''] = normalized.split('.');
   if (fraction.length > POINTS_SCALE) {
      throw new Error(`Loan amount must have at most ${POINTS_SCALE} decimal places`);
   }
   const paddedFraction = fraction.padEnd(POINTS_SCALE, '0');
   const scaleFactor = 10n ** BigInt(POINTS_SCALE);
   return BigInt(whole) * scaleFactor + BigInt(paddedFraction || '0');
};

const pointsMajorToMinor = (points: number): bigint => BigInt(Math.trunc(points)) * 10n ** BigInt(POINTS_SCALE);

export const LOAN_FUNDING_POINTS_PER_USDC = 1;

export const getYearOneIouBorrowerBonusPoints = (borrowerPriorFundedLoanCount: number): number => {
   const priorFundedLoans = Math.max(0, Math.trunc(borrowerPriorFundedLoanCount));
   if (priorFundedLoans === 0) return 25;
   if (priorFundedLoans === 1) return 20;
   if (priorFundedLoans === 2) return 15;
   return 10;
};

export const computeYearOneIouPointsDelta = (loanAmount: string | number, borrowerPriorFundedLoanCount: number): bigint => {
   const base = parseAmountToMinorUnits(loanAmount) * LOAN_FUNDING_POINTS_MULTIPLIER;
   return base + pointsMajorToMinor(getYearOneIouBorrowerBonusPoints(borrowerPriorFundedLoanCount));
};
