import { toNumber } from '@/utils/decimalHelpers';

import { type Loan } from '@/types/loanTypes';

/**
 * Interest a lender actually earned on one loan: totalRepayment - loanAmount, only once the loan
 * is fully repaid and was not refunded (a refund only returns principal). Everything else is 0.
 */
export const getLoanInterestEarned = (loan: Loan): number => {
   if (loan.repaymentStatus !== 'Paid' || loan.refundedAt) return 0;
   return Math.max(0, toNumber(loan.totalRepaymentAmount) - toNumber(loan.loanAmount));
};

/** Total interest earned across loans (see getLoanInterestEarned). */
export const sumInterestEarned = (loans: Loan[]): number => loans.reduce((sum, loan) => sum + getLoanInterestEarned(loan), 0);
