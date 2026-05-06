import { toNumber } from '@/utils/decimalHelpers';

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

      const dueDate = new Date(loan.due_date);
      if (Number.isNaN(dueDate.getTime()) || dueDate.getTime() >= now.getTime()) {
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
