import { CREDIT_TIERS, MAX_CREDIT_LIMIT, STARTING_CREDIT_LIMIT, getNextCreditTier } from '@/config/creditTiers';
import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

export const CREDIT_STEP = 20;
export const MIN_CREDIT_LIMIT = STARTING_CREDIT_LIMIT;
export { CREDIT_TIERS, MAX_CREDIT_LIMIT };

// Due dates are stored at midnight UTC, so a loan "due the 15th" is due at 2026-07-15T00:00:00Z.
// It stays on time through the entire due date and only becomes overdue the day AFTER it (the 16th).
export const OVERDUE_AFTER_DUE_DATE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a repayment made at `paidAt` counts as on time for a loan due at `dueDate`.
 * Single source of truth — use everywhere on-time is judged (credit progression, the cumulative
 * volume gate, and dashboard displays) so they never drift apart.
 */
export const isRepaidOnTime = (paidAt: string | Date, dueDate: string | Date): boolean =>
   parseDateSafely(paidAt).getTime() < parseDateSafely(dueDate).getTime() + OVERDUE_AFTER_DUE_DATE_MS;

type CreditProgressionInput = {
   currentLimit: number | null | undefined;
   isVerified: boolean;
   isPaused: boolean;
   repaidAmount: number | null | undefined;
   totalRepaymentAmount: number | null | undefined;
   cumulativeBorrowedAmount: number | null | undefined;
   dueDate: string;
   paidAt: string;
};

type CreditProgressionResult = {
   shouldPause: boolean;
   shouldLevelUp: boolean;
   nextLimit: number;
   isLate: boolean;
   isFullyRepaid: boolean;
};

export const getEffectiveCreditLimit = (cs: number | null | undefined, isVerified: boolean): number => {
   if (!isVerified) return 0;
   return Math.min(Math.max(toNumber(cs ?? 0), MIN_CREDIT_LIMIT), MAX_CREDIT_LIMIT);
};

export const evaluateCreditProgression = ({
   currentLimit,
   isVerified,
   isPaused,
   repaidAmount,
   totalRepaymentAmount,
   cumulativeBorrowedAmount,
   dueDate,
   paidAt
}: CreditProgressionInput): CreditProgressionResult => {
   const normalizedLimit = getEffectiveCreditLimit(currentLimit, isVerified);
   const repaid = toNumber(repaidAmount ?? 0);
   const totalRepayment = toNumber(totalRepaymentAmount ?? 0);
   const cumulativeBorrowed = toNumber(cumulativeBorrowedAmount ?? 0);
   const isFullyRepaid = totalRepayment > 0 && repaid >= totalRepayment;
   const isLate = !isRepaidOnTime(paidAt, dueDate);
   const meetsCumulativeVolume = cumulativeBorrowed >= normalizedLimit;
   const shouldPause = isLate;
   const canLevelUp =
      isVerified && !isPaused && !shouldPause && isFullyRepaid && meetsCumulativeVolume && normalizedLimit < MAX_CREDIT_LIMIT;

   return {
      shouldPause,
      shouldLevelUp: canLevelUp,
      nextLimit: getNextCreditTier(normalizedLimit),
      isLate,
      isFullyRepaid
   };
};
