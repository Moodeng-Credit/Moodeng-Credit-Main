import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { isExactCreditTier } from '@/config/creditTiers';
import type { Loan } from '@/types/loanTypes';
import type { CreditLevel } from '@/views/profile/components/tabs/types';

export type DashboardMilestoneStatus = 'next' | 'unlocked' | 'locked';

export interface DashboardMilestone {
   id: string;
   pointSourceId: string;
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

export const formatMilestoneTrustPoints = (milestone: Pick<DashboardMilestone, 'points'>) =>
   milestone.points ? `+${milestone.points} Trust Points` : 'Trust Points';

export const getMilestoneSummary = (milestone: DashboardMilestone) => {
   const pointReward = formatMilestoneTrustPoints(milestone);

   if (milestone.status === 'unlocked') {
      return `Earned ${pointReward}${milestone.benefit ? ` · ${milestone.benefit}` : ''}`;
   }

   if (milestone.status === 'locked') {
      return `Reward: ${pointReward}`;
   }

   return `Reward: ${pointReward}`;
};

export const getDashboardMilestoneHighlights = (milestones: DashboardMilestone[], limit = 3): DashboardMilestone[] => {
   const selected: DashboardMilestone[] = [];
   const selectedIds = new Set<string>();

   const addMilestones = (items: DashboardMilestone[], maxCount = Number.POSITIVE_INFINITY) => {
      for (const item of items) {
         if (selected.length >= limit || selected.filter((milestone) => items.includes(milestone)).length >= maxCount) break;
         if (selectedIds.has(item.id)) continue;

         selected.push(item);
         selectedIds.add(item.id);
      }
   };

   const nextMilestones = milestones.filter((milestone) => milestone.status === 'next');
   const unlockedMilestones = milestones.filter((milestone) => milestone.status === 'unlocked');
   const lockedMilestones = milestones.filter((milestone) => milestone.status === 'locked');
   const latestUnlocked = unlockedMilestones.length ? [unlockedMilestones[unlockedMilestones.length - 1]] : [];

   addMilestones(nextMilestones, 2);
   addMilestones(latestUnlocked, 1);
   addMilestones(lockedMilestones);
   addMilestones([...unlockedMilestones].reverse());
   addMilestones(milestones);

   return selected.slice(0, limit);
};

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
         pointSourceId: '9c826a2d-2fc8-43b5-95b6-09d7f21f1e01',
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
         pointSourceId: '6cb37536-68e5-4d38-a2eb-ef850b69c7ad',
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
         pointSourceId: 'a030a2e0-3955-443a-b2c7-e1ac03f0319f',
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
         pointSourceId: '30898ca5-6a8f-4275-8b33-56d5d797435b',
         title: 'Repay a loan on time',
         description: 'Pay the full amount before the due date to start your repayment record.',
         points: 20,
         reward: `Trust Points earned${currentLevelAmount ? ` · up to $${currentLevelAmount}` : ''}`,
         outcome: 'Trust Points earned',
         benefit: currentLevelAmount ? `Up to $${currentLevelAmount}` : 'Limit progress',
         isComplete: onTimePaidLoans.length >= 1,
         actionLabel: 'Pay loans',
         actionTo: nextActionTo
      },
      {
         id: 'two-on-time-streak',
         pointSourceId: 'f7c1c0d2-93a9-404d-925c-7201d20d0d84',
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
         pointSourceId: '1e10653e-46ce-4c8d-b2ef-738f3c55a7c9',
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
         pointSourceId: '05d358b1-ce9b-49ec-9fd6-61611c1e4e37',
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
         pointSourceId: 'e4a7c7cb-2a88-483e-ad57-a79b35e1a32b',
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
         pointSourceId: 'fe748497-60b8-4545-b44c-3f77c7172dc6',
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
         pointSourceId: '3d321dad-0854-4f4b-aa95-5441a8f77099',
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
