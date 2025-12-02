import type { Loan } from "@/types/loanTypes";
import { formatDate } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

 export const getCreditMilestoneDetails = (amount: number, totalCredited: number, repayments: Loan[]) => {
    const loanHitIndex = repayments.findIndex((_, index) => {
      const current = repayments
          .slice(0, index + 1)
          .reduce((sum, loan) => sum + toNumber(loan.loanAmount), 0);
      return current >= amount;
    });


   const maxHitIndex = repayments.findIndex((_, index) => {
      const current = repayments
          .slice(0, index + 1)
          .reduce((sum, loan) => sum + toNumber(loan.loanAmount), 0);
      return current >= totalCredited;
    });

    const loanHit = repayments[loanHitIndex];


   console.log("CREDIT MILESTONE", { loanHitIndex, amount, totalCredited, loanHit, repayments })


    if (loanHit) {
      return {
        date: formatDate(loanHit.createdAt),
        lender: loanHit.lenderUser || 'Anonymous',
        reason: loanHit.reason,
        repayTime: `${loanHit.days} DAYS TO REPAY`,
        unlocked: loanHitIndex <= maxHitIndex,
      }
    }

   return {
      unlocked: false,
    }
}