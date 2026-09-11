import { toNumber } from '@/utils/decimalHelpers';
import { isLoanPastDue } from '@/utils/loanOverdue';

export type DefaultableLoan = {
   due_date: string | null;
   loan_status: string | null;
   repayment_status: string | null;
   repaid_amount: number | null;
   total_repayment_amount: number | null;
};

export type DefaultedBorrowerSupport = {
   count: number;
   overdueAmount: number;
};

export const EMPTY_DEFAULTED_BORROWER_SUPPORT: DefaultedBorrowerSupport = {
   count: 0,
   overdueAmount: 0
};

export function calculateDefaultedBorrowerSupport(
   loans: DefaultableLoan[],
   now: Date = new Date()
): DefaultedBorrowerSupport {
   return loans.reduce<DefaultedBorrowerSupport>((summary, loan) => {
      if (loan.loan_status !== 'Lent' || loan.repayment_status === 'Paid' || !loan.due_date) {
         return summary;
      }

      // A loan whose repayment is merely due (within the 24h grace window) is NOT yet a default.
      // Use the shared graced check so the borrower side matches the lender side (PR #872/#873) and
      // the backend loan-overdue-notifications job — otherwise a borrower repaying ON their due date
      // is wrongly flagged overdue and bounced to /account-restricted, unable to reach /repay.
      if (!isLoanPastDue(loan.due_date, now)) {
         return summary;
      }

      const remainingAmount = Math.max(
         0,
         toNumber(loan.total_repayment_amount ?? 0) - toNumber(loan.repaid_amount ?? 0)
      );
      if (remainingAmount <= 0) {
         return summary;
      }

      return {
         count: summary.count + 1,
         overdueAmount: summary.overdueAmount + remainingAmount
      };
   }, EMPTY_DEFAULTED_BORROWER_SUPPORT);
}
