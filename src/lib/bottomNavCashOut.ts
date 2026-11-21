import type { Loan } from '@/types/loanTypes';

/** How long after a loan is funded the nav shows "Cash out" where "Repay" usually sits. */
export const CASH_OUT_TAB_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * True while the borrower has an unpaid loan that was funded in the last 24 hours.
 * New borrowers took the Repay tab for "get my money" and paid the loan straight back
 * (Nov 2026), so for the first day the tab points to cash-out instead.
 */
export function shouldShowCashOutTab(loans: Loan[], userId: string | undefined, now: number = Date.now()): boolean {
   if (!userId) return false;
   return loans.some((loan) => {
      if (loan.borrowerUser !== userId || loan.loanStatus !== 'Lent' || loan.repaymentStatus === 'Paid') return false;
      if (!loan.fundedAt) return false;
      const fundedAt = new Date(loan.fundedAt).getTime();
      if (Number.isNaN(fundedAt)) return false;
      const age = now - fundedAt;
      return age >= 0 && age < CASH_OUT_TAB_WINDOW_MS;
   });
}
