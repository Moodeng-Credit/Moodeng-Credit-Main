import type { Loan } from '@/types/loanTypes';

/**
 * Renders loan status with appropriate color styling
 * @param loan - The loan object containing status information
 * @returns JSX element with styled loan status text
 */
export const renderLoanStatus = (loan: Loan) => (
   <span
      className={`font-bold ${
         loan.repaymentStatus === 'Paid' ? 'text-[#166534]' : loan.repaymentStatus === 'Unpaid' ? 'text-[#b91c1c]' : 'text-gray-700'
      }`}
   >
      {loan.loanStatus}, {loan.repaymentStatus}
   </span>
);

/**
 * Gets the color class for loan status text
 * @param repaymentStatus - The repayment status of the loan
 * @returns Tailwind color class string
 */
export const getLoanStatusColor = (repaymentStatus: string): string => {
   if (repaymentStatus === 'Paid') return 'text-[#166534]';
   if (repaymentStatus === 'Unpaid') return 'text-[#b91c1c]';
   return 'text-gray-700';
};

/**
 * Gets the status badge styling for loan cards
 * @param loanStatus - The overall status of the loan
 * @param repaymentStatus - The repayment status
 * @param differenceInDays - Days remaining until due date
 * @returns Object with background and text color classes
 */
export const getLoanBadgeStyles = (
   loanStatus: string,
   repaymentStatus: string,
   differenceInDays: number
): { bgClass: string; textClass: string; borderClass: string } => {
   if (loanStatus === 'Requested') {
      return {
         bgClass: 'bg-[#F3E8FF]',
         textClass: 'text-[#A78BFA]',
         borderClass: 'border-[#EDE9FE]'
      };
   }

   if (repaymentStatus === 'Paid') {
      return {
         bgClass: 'bg-[#F3E8FF]',
         textClass: 'text-[#A78BFA]',
         borderClass: 'border-[#EDE9FE]'
      };
   }

   if (loanStatus === 'Lent' && repaymentStatus !== 'Paid') {
      if (differenceInDays > 29) {
         return {
            bgClass: 'bg-[#D1FAE5]',
            textClass: 'text-[#22C55E]',
            borderClass: 'border-[#A7F3D0]'
         };
      }
      if (differenceInDays > 6) {
         return {
            bgClass: 'bg-[#FEF3C7]',
            textClass: 'text-[#D97706]',
            borderClass: 'border-[#FDE68A]'
         };
      }
      return {
         bgClass: 'bg-[#FEE2E2]',
         textClass: 'text-[#EF4444]',
         borderClass: 'border-[#FECACA]'
      };
   }

   return {
      bgClass: 'bg-[#F3E8FF]',
      textClass: 'text-[#A78BFA]',
      borderClass: 'border-[#EDE9FE]'
   };
};
