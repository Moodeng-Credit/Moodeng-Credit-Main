import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { isExactCreditTier } from '@/config/creditTiers';
import { isRepaidOnTime } from '@/lib/creditLeveling';
import { trustPointMilestoneRuleById } from '@/shared/points';
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
   // A refund reads back as 'Paid' with repaidAmount stamped to the full total, but the borrower
   // defaulted — it must never count as an on-time repayment (would advance their credit level).
   if (loan.repaymentStatus !== 'Paid' || loan.refundedAt) return false;
   const repaidAmount = toNumber(loan.repaidAmount);
   const totalRepayment = toNumber(loan.totalRepaymentAmount);
   const isFullyRepaid = totalRepayment > 0 ? repaidAmount >= totalRepayment : repaidAmount > 0;
   if (!isFullyRepaid) return false;
   return isRepaidOnTime(loan.updatedAt, loan.dueDate);
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
   const paidLoans = borrowerLoans.filter((loan) => loan.repaymentStatus === 'Paid' && !loan.refundedAt);
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
         pointSourceId: trustPointMilestoneRuleById['verify-identity'].pointSourceId,
         title: isVerified ? 'Identity verified' : 'Verify your identity',
         description: isVerified
            ? 'Your account can request borrower credit.'
            : 'Unlock borrowing and start building your public trust record.',
         points: trustPointMilestoneRuleById['verify-identity'].points,
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
         pointSourceId: trustPointMilestoneRuleById['first-loan-request'].pointSourceId,
         title: 'Post your first loan request',
         description: 'Ask for a small amount with a clear reason and due date.',
         points: trustPointMilestoneRuleById['first-loan-request'].points,
         reward: 'Visible to lenders',
         outcome: 'Visible to lenders',
         benefit: 'Request live',
         isComplete: hasRequestedLoan,
         actionLabel: 'Request a loan',
         actionTo: '/request-board'
      },
      {
         id: 'first-funded-loan',
         pointSourceId: trustPointMilestoneRuleById['first-funded-loan'].pointSourceId,
         title: 'Get funded by a lender',
         description: 'A lender accepts your request and trusts you with your first loan.',
         points: trustPointMilestoneRuleById['first-funded-loan'].points,
         reward: 'First lender signal',
         outcome: 'Lender signal gained',
         benefit: 'History started',
         isComplete: fundedLoans.length >= 1,
         actionLabel: 'View requests',
         actionTo: '/request-board'
      },
      {
         id: 'first-on-time-repayment',
         pointSourceId: trustPointMilestoneRuleById['first-on-time-repayment'].pointSourceId,
         title: 'Repay a loan on time',
         description: 'Pay the full amount before the due date to start your repayment record.',
         points: trustPointMilestoneRuleById['first-on-time-repayment'].points,
         reward: `Trust Points earned${currentLevelAmount ? ` · up to $${currentLevelAmount}` : ''}`,
         outcome: 'Trust Points earned',
         benefit: currentLevelAmount ? `Up to $${currentLevelAmount}` : 'Limit progress',
         isComplete: onTimePaidLoans.length >= 1,
         actionLabel: 'Pay loans',
         actionTo: nextActionTo
      },
      {
         id: 'two-on-time-streak',
         pointSourceId: trustPointMilestoneRuleById['two-on-time-streak'].pointSourceId,
         title: 'Build a 2-loan on-time streak',
         description: 'Show lenders that your repayment reliability is repeatable.',
         points: trustPointMilestoneRuleById['two-on-time-streak'].points,
         reward: 'Stronger lender confidence',
         outcome: 'Reliability improved',
         benefit: 'Stronger profile',
         isComplete: onTimePaidLoans.length >= 2,
         actionLabel: 'Keep building',
         actionTo: nextActionTo
      },
      {
         id: 'full-limit-credit-builder',
         pointSourceId: trustPointMilestoneRuleById['full-limit-credit-builder'].pointSourceId,
         title: 'Repay a full-limit credit-builder',
         description: 'Use your current Credit Level amount and repay it on time.',
         points: trustPointMilestoneRuleById['full-limit-credit-builder'].points,
         reward: 'Credit Level progress',
         outcome: 'Level progress',
         benefit: 'Higher limit path',
         isComplete: hasFullLimitRepayment,
         actionLabel: 'Learn levels',
         actionTo: '/credit-leveling-guide'
      },
      {
         id: 'two-unique-lenders',
         pointSourceId: trustPointMilestoneRuleById['two-unique-lenders'].pointSourceId,
         title: 'Borrow from 2 different lenders',
         description: 'Build a reputation that does not depend on just one lender.',
         points: trustPointMilestoneRuleById['two-unique-lenders'].points,
         reward: 'Lender diversity signal',
         outcome: 'Diversity improved',
         benefit: 'Broader trust',
         isComplete: uniqueLenders >= 2,
         actionLabel: 'Request a loan',
         actionTo: '/request-board'
      },
      {
         id: 'repay-100-total',
         pointSourceId: trustPointMilestoneRuleById['repay-100-total'].pointSourceId,
         title: 'Repay $100 total',
         description: 'Grow from starter loans into a real repayment history.',
         points: trustPointMilestoneRuleById['repay-100-total'].points,
         reward: 'Volume trust signal',
         outcome: 'Volume signal',
         benefit: '$100 repaid',
         isComplete: totalRepaid >= 100,
         actionLabel: 'Pay loans',
         actionTo: nextActionTo
      },
      {
         id: 'reach-level-three',
         pointSourceId: trustPointMilestoneRuleById['reach-level-three'].pointSourceId,
         title: 'Reach Credit Level 3',
         description: 'Unlock a higher borrowing limit through verified on-time repayment.',
         points: trustPointMilestoneRuleById['reach-level-three'].points,
         reward: 'Higher borrowing power',
         outcome: 'Higher limit unlocked',
         benefit: 'Level 3',
         isComplete: unlockedLevels.length >= 3,
         actionLabel: 'View guide',
         actionTo: '/credit-leveling-guide'
      },
      {
         id: 'trusted-borrower-candidate',
         pointSourceId: trustPointMilestoneRuleById['trusted-borrower-candidate'].pointSourceId,
         title: 'Become a trusted borrower candidate',
         description: 'Complete 5 on-time repayments, use 3 lenders, and keep defaults resolved.',
         points: trustPointMilestoneRuleById['trusted-borrower-candidate'].points,
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
