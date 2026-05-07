import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { isExactCreditTier } from '@/config/creditTiers';
import type { Loan } from '@/types/loanTypes';
import type { CreditLevel } from '@/views/profile/components/tabs/types';

export type DashboardMilestoneStatus = 'next' | 'unlocked' | 'locked';

export interface DashboardMilestone {
   id: string;
   title: string;
   description: string;
   status: DashboardMilestoneStatus;
   eyebrow: string;
   outcome: string;
   benefit: string;
   points?: number;
   reward?: string;
   actionLabel?: string;
   actionTo?: string;
}

const isLoanPaidOnTime = (loan: Loan): boolean => {
   if (loan.repaymentStatus !== 'Paid') return false;
   const repaidAmount = toNumber(loan.repaidAmount);
   const totalRepayment = toNumber(loan.totalRepaymentAmount);
   const isFullyRepaid = totalRepayment > 0 ? repaidAmount >= totalRepayment : repaidAmount > 0;
   if (!isFullyRepaid) return false;
   return parseDateSafely(loan.updatedAt).getTime() <= parseDateSafely(loan.dueDate).getTime();
};

export const getBorrowerLoans = (loans: Loan[], userId: string) => loans.filter((loan) => loan.borrowerUser === userId);

export const getFundedBorrowerLoans = (loans: Loan[], userId: string) =>
   getBorrowerLoans(loans, userId).filter((loan) => loan.loanStatus === 'Lent');

const getOnTimePaidLoans = (loans: Loan[]) => loans.filter(isLoanPaidOnTime);

const hasUnresolvedDefault = (loan: Loan): boolean =>
   loan.loanStatus === 'Lent' && loan.repaymentStatus !== 'Paid' && parseDateSafely(loan.dueDate).getTime() < Date.now();

const countUniqueLenders = (loans: Loan[]): number => new Set(loans.map((loan) => loan.lenderUser).filter(Boolean)).size;

type MilestoneDefinition = Omit<DashboardMilestone, 'status' | 'eyebrow'> & {
   isComplete: boolean;
   completeEyebrow?: string;
   nextEyebrow?: string;
   lockedEyebrow?: string;
};

const applyMilestoneStatuses = (definitions: MilestoneDefinition[]): DashboardMilestone[] => {
   let nextAssigned = false;

   return definitions.map(
      ({ isComplete, completeEyebrow = 'Completed', nextEyebrow = 'Next milestone', lockedEyebrow = 'Locked', ...milestone }) => {
         if (isComplete) {
            return {
               ...milestone,
               eyebrow: completeEyebrow,
               status: 'unlocked'
            };
         }

         if (!nextAssigned) {
            nextAssigned = true;
            return {
               ...milestone,
               eyebrow: nextEyebrow,
               status: 'next'
            };
         }

         return {
            ...milestone,
            eyebrow: lockedEyebrow,
            status: 'locked'
         };
      }
   );
};

export const buildReputationMilestones = ({
   creditLevels,
   borrowerLoans,
   isVerified
}: {
   creditLevels: CreditLevel[];
   borrowerLoans: Loan[];
   isVerified: boolean;
}): DashboardMilestone[] => {
   const fundedLoans = borrowerLoans.filter((loan) => loan.loanStatus === 'Lent');
   const paidLoans = borrowerLoans.filter((loan) => loan.repaymentStatus === 'Paid');
   const onTimePaidLoans = getOnTimePaidLoans(borrowerLoans);
   const unlockedLevels = creditLevels.filter((level) => level.unlocked);
   const currentLevel = unlockedLevels[unlockedLevels.length - 1];
   const nextLevel = creditLevels.find((level) => !level.unlocked);
   const currentLevelAmount = currentLevel?.amount ?? nextLevel?.amount;
   const hasActiveLoanToRepay = borrowerLoans.some((loan) => loan.loanStatus === 'Lent' && loan.repaymentStatus !== 'Paid');
   const hasRequestedLoan = borrowerLoans.length > 0;
   const hasFullLimitRepayment = onTimePaidLoans.some((loan) => isExactCreditTier(toNumber(loan.loanAmount)));
   const uniqueLenders = countUniqueLenders(fundedLoans);
   const totalRepaid = paidLoans.reduce((sum, loan) => sum + toNumber(loan.repaidAmount), 0);
   const hasDefaults = borrowerLoans.some(hasUnresolvedDefault);
   const nextActionTo = hasActiveLoanToRepay ? '/repay' : '/request-board';

   return applyMilestoneStatuses([
      {
         id: 'verify-identity',
         title: isVerified ? 'Identity verified' : 'Verify your identity',
         description: isVerified
            ? 'Your account can request borrower credit.'
            : 'Unlock borrowing and start building your public trust record.',
         points: 10,
         reward: 'Borrowing unlocked',
         outcome: 'Borrowing unlocked',
         benefit: 'Verified profile',
         isComplete: isVerified,
         actionLabel: 'Verify now',
         actionTo: '/verify-world-id',
         completeEyebrow: 'Account ready'
      },
      {
         id: 'first-loan-request',
         title: 'Post your first loan request',
         description: 'Ask for a small amount with a clear reason and due date.',
         points: 10,
         reward: 'Visible to lenders',
         outcome: 'Visible to lenders',
         benefit: 'Request live',
         isComplete: hasRequestedLoan,
         actionLabel: 'Request a loan',
         actionTo: '/request-board'
      },
      {
         id: 'first-funded-loan',
         title: 'Get funded by a lender',
         description: 'A lender accepts your request and trusts you with your first loan.',
         points: 15,
         reward: 'First lender signal',
         outcome: 'Lender signal gained',
         benefit: 'History started',
         isComplete: fundedLoans.length >= 1,
         actionLabel: 'View requests',
         actionTo: '/request-board'
      },
      {
         id: 'first-on-time-repayment',
         title: 'Repay a loan on time',
         description: 'Pay the full amount before the due date to start your repayment record.',
         points: 20,
         reward: `Trust Score boost${currentLevelAmount ? ` · up to $${currentLevelAmount}` : ''}`,
         outcome: 'Trust Score increased',
         benefit: currentLevelAmount ? `Up to $${currentLevelAmount}` : 'Limit progress',
         isComplete: onTimePaidLoans.length >= 1,
         actionLabel: 'Pay loans',
         actionTo: nextActionTo
      },
      {
         id: 'two-on-time-streak',
         title: 'Build a 2-loan on-time streak',
         description: 'Show lenders that your repayment reliability is repeatable.',
         points: 25,
         reward: 'Stronger lender confidence',
         outcome: 'Reliability improved',
         benefit: 'Stronger profile',
         isComplete: onTimePaidLoans.length >= 2,
         actionLabel: 'Keep building',
         actionTo: nextActionTo
      },
      {
         id: 'full-limit-credit-builder',
         title: 'Repay a full-limit credit-builder',
         description: 'Use your current Credit Level amount and repay it on time.',
         points: 30,
         reward: 'Credit Level progress',
         outcome: 'Level progress',
         benefit: 'Higher limit path',
         isComplete: hasFullLimitRepayment,
         actionLabel: 'Learn levels',
         actionTo: '/credit-leveling-guide'
      },
      {
         id: 'two-unique-lenders',
         title: 'Borrow from 2 different lenders',
         description: 'Build a reputation that does not depend on just one lender.',
         points: 30,
         reward: 'Lender diversity signal',
         outcome: 'Diversity improved',
         benefit: 'Broader trust',
         isComplete: uniqueLenders >= 2,
         actionLabel: 'Request a loan',
         actionTo: '/request-board'
      },
      {
         id: 'repay-100-total',
         title: 'Repay $100 total',
         description: 'Grow from starter loans into a real repayment history.',
         points: 40,
         reward: 'Volume trust signal',
         outcome: 'Volume signal',
         benefit: '$100 repaid',
         isComplete: totalRepaid >= 100,
         actionLabel: 'Pay loans',
         actionTo: nextActionTo
      },
      {
         id: 'reach-level-three',
         title: 'Reach Credit Level 3',
         description: 'Unlock a higher borrowing limit through verified on-time repayment.',
         points: 50,
         reward: 'Higher borrowing power',
         outcome: 'Higher limit unlocked',
         benefit: 'Level 3',
         isComplete: unlockedLevels.length >= 3,
         actionLabel: 'View guide',
         actionTo: '/credit-leveling-guide'
      },
      {
         id: 'trusted-borrower-candidate',
         title: 'Become a trusted borrower candidate',
         description: 'Complete 5 on-time repayments, use 3 lenders, and keep defaults resolved.',
         points: 75,
         reward: 'Future top-user perks',
         outcome: 'Priority signal',
         benefit: 'Review ready',
         isComplete: onTimePaidLoans.length >= 5 && uniqueLenders >= 3 && !hasDefaults,
         actionLabel: 'Keep building',
         actionTo: nextActionTo,
         lockedEyebrow: 'Top milestone'
      }
   ]);
};
