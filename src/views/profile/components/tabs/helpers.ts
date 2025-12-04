import { formatDate } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import type { Loan } from '@/types/loanTypes';

export const getCreditMilestoneDetails = (amount: number, totalCredited: number, repayments: Loan[]) => {
   const loanHitIndex = repayments.findIndex((_, index) => {
      const current = repayments.slice(0, index + 1).reduce((sum, loan) => sum + toNumber(loan.repaidAmount), 0);
      return current >= amount;
   });

   const loanHit = repayments[loanHitIndex];
   const maxHit = repayments[repayments.length - 1];

   const selectedLoan = loanHit || maxHit;

   if (selectedLoan) {
      return {
         date: formatDate(selectedLoan.createdAt),
         lender: selectedLoan.lenderUser || 'Anonymous',
         reason: selectedLoan.reason,
         repayTime: `${selectedLoan.days} DAYS TO REPAY`,
         unlocked: totalCredited >= amount
      };
   }

   return {
      unlocked: false
   };
};
