import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';
import { getLoanPastDueAt } from '@/utils/loanOverdue';

import {
   CREDIT_TIERS,
   getNextCreditTier,
   INCOME_LADDER_FROM,
   LOW_INCOME_COUNTS_AFTER_DAYS,
   MAX_CREDIT_LIMIT,
   STARTING_CREDIT_LIMIT
} from '@/config/creditTiers';
import { getRewardFromAt } from '@/lib/loanDeadline';
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
   /** When the loan was funded: the 48-hour rule, and a pre-Nov-14 loan's promised old step. */
   fundedAt?: string | null;
   /** When the borrower joined (users.created_at): before October 2026 = Track A, the old ladder. */
   joinedAt?: string | null;
   /** Income ceiling $35 (Track B): their repayment counts from day 7 instead of the 2nd half. */
   lowIncome?: boolean;
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
// One rule since 2026-11-27 (George): a repayment grows the limit only in the loan's SECOND HALF — from
// 00:00 (loan's zone) on its halfway day, never sooner than 48h after funding. Same window as food
// vouchers (getRewardFromAt), and it always holds a 15th or 30th payday. Loans funded before the switch
// keep the 48-hour rule they were shown. Kept in sync with supabase/functions/_shared/creditAndPoints.ts.
export const SECOND_HALF_RULE_FROM = Date.parse('2026-11-27T00:00:00+07:00');

/** When paying this loan starts to grow the limit. Null when the loan has no funding time. */
export const countsFromAt = (
   fundedAt: string | null | undefined,
   dueDate?: string | Date | null,
   dueTimezone?: string | null,
   opts: { lowIncome?: boolean } = {}
): Date | null => {
   const funded = fundedAt ? Date.parse(fundedAt) : NaN;
   if (!Number.isFinite(funded)) return null;
   const fast = new Date(funded + FAST_REPAY_HOURS * 3_600_000);
   if (funded < SECOND_HALF_RULE_FROM) return fast;
   // Low income (ceiling $35): counts from day 7 (creditTiers LOW_INCOME_COUNTS_AFTER_DAYS).
   if (opts.lowIncome && funded >= INCOME_LADDER_FROM) return new Date(funded + LOW_INCOME_COUNTS_AFTER_DAYS * 86_400_000);
   if (!dueDate) return fast;
   return getRewardFromAt(new Date(funded), dueDate, dueTimezone || 'Asia/Manila') ?? fast;
};

/** True when paying at `paidAt` is too early to grow the limit (before `countsFromAt`). */
export const isTooEarlyRepay = (
   fundedAt: string | null | undefined,
   paidAt: string | null | undefined,
   dueDate?: string | Date | null,
   dueTimezone?: string | null,
   opts: { lowIncome?: boolean } = {}
) => {
   const from = countsFromAt(fundedAt, dueDate, dueTimezone, opts);
   const paid = paidAt ? Date.parse(paidAt) : NaN;
   return from !== null && Number.isFinite(paid) && paid < from.getTime();
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
   joinedAt,
   lowIncome = false
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
      isVerified &&
      isFullyRepaid &&
      isFullLimitLoan &&
      normalizedLimit < MAX_CREDIT_LIMIT &&
      !isTooEarlyRepay(fundedAt, paidAt, dueDate, dueTimezone, { lowIncome });

   return {
      shouldLevelUp: canLevelUp,
      nextLimit: getNextCreditTier(normalizedLimit, joinedAt, fundedAt),
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
