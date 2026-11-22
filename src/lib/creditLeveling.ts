import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';
import { getLoanPastDueAt } from '@/utils/loanOverdue';

import { CREDIT_TIERS, getNextCreditTier, MAX_CREDIT_LIMIT, STARTING_CREDIT_LIMIT } from '@/config/creditTiers';
import type { Loan } from '@/types/loanTypes';

export const MIN_CREDIT_LIMIT = STARTING_CREDIT_LIMIT;
export { CREDIT_TIERS, MAX_CREDIT_LIMIT };

/**
 * Whether a repayment made at `paidAt` counts as on time: before the end of the due day on the
 * borrower's clock (`dueTimezone`, else Manila). Same deadline as getLoanPastDueAt.
 */
export const isRepaidOnTime = (paidAt: string | Date, dueDate: string | Date, dueTimezone?: string | null): boolean =>
   parseDateSafely(paidAt).getTime() < getLoanPastDueAt(dueDate, dueTimezone).getTime();

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
   /** When the loan was funded (the 48-hour rule). */
   fundedAt?: string | null;
   /** When the borrower joined (users.created_at): before October 2026 = Track A, the old ladder. */
   joinedAt?: string | null;
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

// A loan repaid within 48 hours of getting it doesn't count (George, 2026-11-18): no level-up, no
// affiliate $5, no food voucher. People were borrowing for 30 days and repaying on day 1–2 to climb fast.
export const FAST_REPAY_HOURS = 48;
/** True when paying at `paidAt` is within 48h of funding: it won't level them up. */
export const isFastRepay = (fundedAt: string | null | undefined, paidAt: string | null | undefined) => {
   const funded = fundedAt ? Date.parse(fundedAt) : NaN;
   const paid = paidAt ? Date.parse(paidAt) : NaN;
   return Number.isFinite(funded) && Number.isFinite(paid) && paid - funded < FAST_REPAY_HOURS * 3_600_000;
};
/** When a repayment starts counting (48h after funding). */
export const countsFromAt = (fundedAt: string | null | undefined) => {
   const funded = fundedAt ? Date.parse(fundedAt) : NaN;
   return Number.isFinite(funded) ? new Date(funded + FAST_REPAY_HOURS * 3_600_000) : null;
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
   fundedAt,
   joinedAt
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
   const canLevelUp =
      isVerified && isFullyRepaid && isFullLimitLoan && normalizedLimit < MAX_CREDIT_LIMIT && !isFastRepay(fundedAt, paidAt);

   return {
      shouldLevelUp: canLevelUp,
      nextLimit: getNextCreditTier(normalizedLimit, joinedAt),
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
