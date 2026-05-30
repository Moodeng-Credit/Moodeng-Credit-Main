import { parseDateSafely } from '@/utils/dateFormatters';

import { type Loan, LoanStatus, RepaymentStatus } from '@/types/loanTypes';

export const REQUEST_EXPIRATION_DAYS = 7;
const REQUEST_EXPIRATION_MS = REQUEST_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

type CreditUsageLoan = Pick<Loan, 'createdAt' | 'loanAmount' | 'loanStatus' | 'repaymentStatus'>;

export const isExpiredUnfundedRequest = (loan: Pick<Loan, 'createdAt' | 'loanStatus'>, now = new Date()) => {
   if (loan.loanStatus !== LoanStatus.REQUESTED) return false;
   if (!loan.createdAt) return false;

   return parseDateSafely(loan.createdAt).getTime() + REQUEST_EXPIRATION_MS <= now.getTime();
};

export const isLoanUsingBorrowerCredit = (loan: CreditUsageLoan, now = new Date()) => {
   if (loan.loanStatus === LoanStatus.REQUESTED) {
      return !isExpiredUnfundedRequest(loan, now);
   }

   return loan.loanStatus === LoanStatus.LENT && loan.repaymentStatus !== RepaymentStatus.PAID;
};

export const getBorrowerUsedCreditAmount = (loans: CreditUsageLoan[], now = new Date()) =>
   loans.filter((loan) => isLoanUsingBorrowerCredit(loan, now)).reduce((sum, loan) => sum + Number(loan.loanAmount || 0), 0);

export const getBorrowerActiveLoanCount = (loans: CreditUsageLoan[], now = new Date()) =>
   loans.filter((loan) => isLoanUsingBorrowerCredit(loan, now)).length;

export const isRequestBoardLoanVisible = (loan: Pick<Loan, 'createdAt' | 'loanStatus'>, now = new Date()) =>
   !isExpiredUnfundedRequest(loan, now);
