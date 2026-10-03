import { CREDIT_TIERS, MAX_CREDIT_LIMIT, STARTING_CREDIT_LIMIT, getNextCreditTier } from '@/config/creditTiers';
import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import type { Loan } from '@/types/loanTypes';

export const MIN_CREDIT_LIMIT = STARTING_CREDIT_LIMIT;
export { CREDIT_TIERS, MAX_CREDIT_LIMIT };

// Due dates are stored at midnight UTC, so a loan "due the 15th" is due at 2026-07-15T00:00:00Z.
// It stays on time through the entire due date and only becomes overdue the day AFTER it (the 16th).
export const OVERDUE_AFTER_DUE_DATE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a repayment made at `paidAt` counts as on time for a loan due at `dueDate`.
 * Single source of truth — use everywhere on-time is judged (credit progression and dashboard
 * displays) so they never drift apart.
 */
export const isRepaidOnTime = (paidAt: string | Date, dueDate: string | Date): boolean =>
   parseDateSafely(paidAt).getTime() < parseDateSafely(dueDate).getTime() + OVERDUE_AFTER_DUE_DATE_MS;

type CreditProgressionInput = {
   currentLimit: number | null | undefined;
   isVerified: boolean;
   repaidAmount: number | null | undefined;
   totalRepaymentAmount: number | null | undefined;
   /** Principal the borrower requested on the loan just repaid (not the repayment total). */
   loanAmount: number | null | undefined;
   dueDate: string;
   paidAt: string;
};

type CreditProgressionResult = {
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
   repaidAmount,
   totalRepaymentAmount,
   loanAmount,
   dueDate,
   paidAt
}: CreditProgressionInput): CreditProgressionResult => {
   const normalizedLimit = getEffectiveCreditLimit(currentLimit, isVerified);
   const repaid = toNumber(repaidAmount ?? 0);
   const totalRepayment = toNumber(totalRepaymentAmount ?? 0);
   const principal = toNumber(loanAmount ?? 0);
   const isFullyRepaid = totalRepayment > 0 && repaid >= totalRepayment;
   const isLate = !isRepaidOnTime(paidAt, dueDate);
   // Only a full-limit loan levels you up: request at least your current limit, then repay it in full.
   // A smaller request is a trust-building loan and never levels up, even when principal + interest
   // reaches the limit or several small loans add up to it. Lateness doesn't block it: most late
   // repayments are tech trouble (wallets, exchanges), not the borrower's fault.
   const isFullLimitLoan = principal >= normalizedLimit;
   const canLevelUp = isVerified && isFullyRepaid && isFullLimitLoan && normalizedLimit < MAX_CREDIT_LIMIT;

   return {
      shouldLevelUp: canLevelUp,
      nextLimit: getNextCreditTier(normalizedLimit),
      isLate,
      isFullyRepaid
   };
};

/**
 * A borrower's full-limit (credit-building) loans, each mapped to the limit it was measured against.
 * Same rule as `evaluateCreditProgression`: a loan at or above the limit at the time is full-limit;
 * anything smaller is trust-building, even at a tier amount (a $20 loan on a $40 limit).
 *
 * - Fully repaid loans use the limit the server recorded at repayment (`creditLimitAtRepayment`, written
 *   in the same update that marks the loan Paid; older loans were backfilled). A loan with none was
 *   repaid by an unverified borrower and is not full-limit.
 * - Pass `currentLimit` to also count an open funded loan at or above it. A full-limit request can't
 *   sit alongside any other open loan (the request cap), so the current limit is the one it was taken at.
 */
export const getFullLimitLoans = (loans: Loan[], currentLimit?: number): Map<Loan, number> => {
   const fullLimitLoans = new Map<Loan, number>();

   loans.forEach((loan) => {
      if (loan.repaymentStatus !== 'Paid' || loan.refundedAt || loan.isTest) return;
      const totalRepayment = toNumber(loan.totalRepaymentAmount);
      const isFullyRepaid = totalRepayment > 0 ? toNumber(loan.repaidAmount) >= totalRepayment : toNumber(loan.repaidAmount) > 0;
      if (isFullyRepaid && loan.creditLimitAtRepayment !== undefined && toNumber(loan.loanAmount) >= loan.creditLimitAtRepayment) {
         fullLimitLoans.set(loan, loan.creditLimitAtRepayment);
      }
   });

   if (currentLimit !== undefined && currentLimit > 0) {
      loans
         .filter(
            (loan) =>
               loan.loanStatus === 'Lent' &&
               loan.repaymentStatus !== 'Paid' &&
               !loan.refundedAt &&
               !loan.isTest &&
               toNumber(loan.loanAmount) >= currentLimit
         )
         .forEach((loan) => fullLimitLoans.set(loan, currentLimit));
   }

   return fullLimitLoans;
};
