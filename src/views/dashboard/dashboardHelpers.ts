import { formatDate, parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { CREDIT_TIERS, getNextCreditTier } from '@/config/creditTiers';
import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';
import type { CreditLevel } from '@/views/profile/components/tabs/types';

export type DashboardMilestoneStatus = 'next' | 'unlocked' | 'locked';

export interface DashboardMilestone {
   id: string;
   title: string;
   description: string;
   status: DashboardMilestoneStatus;
   eyebrow: string;
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

export const getOnTimePaidLoans = (loans: Loan[]) => loans.filter(isLoanPaidOnTime);

export const buildReputationMilestones = ({
   creditLevels,
   borrowerLoans,
   isVerified
}: {
   creditLevels: CreditLevel[];
   borrowerLoans: Loan[];
   isVerified: boolean;
}): DashboardMilestone[] => {
   const onTimePaidLoans = getOnTimePaidLoans(borrowerLoans);
   const unlockedLevels = creditLevels.filter((level) => level.unlocked);
   const nextLockedLevel = creditLevels.find((level) => !level.unlocked);
   const currentLevel = unlockedLevels[unlockedLevels.length - 1];

   if (!isVerified) {
      return [
         {
            id: 'verify-world-id',
            eyebrow: 'Next milestone',
            title: 'Verify your borrower account',
            description: 'Complete verification before you can request new loans.',
            status: 'next',
            actionLabel: 'Verify',
            actionTo: '/verify-world-id'
         },
         {
            id: 'first-on-time-repayment',
            eyebrow: 'Locked',
            title: 'Repay a loan on time',
            description: 'Your first on-time repayment starts your visible reputation history.',
            status: 'locked'
         },
         {
            id: 'unlock-credit-tier',
            eyebrow: 'Locked',
            title: 'Unlock higher credit levels',
            description: 'Verification and successful repayments unlock future loan limits.',
            status: 'locked'
         }
      ];
   }

   return [
      {
         id: 'on-time-repayment',
         eyebrow: onTimePaidLoans.length > 0 ? 'Unlocked' : 'Next milestone',
         title: onTimePaidLoans.length > 0 ? 'On-time repayment completed' : 'Repay a loan on time',
         description:
            onTimePaidLoans.length > 0
               ? `${onTimePaidLoans.length} on-time ${onTimePaidLoans.length === 1 ? 'repayment' : 'repayments'} counted toward your reputation.`
               : 'Complete a full repayment by the due date to build trust with lenders.',
         status: onTimePaidLoans.length > 0 ? 'unlocked' : 'next',
         actionLabel: onTimePaidLoans.length > 0 ? 'View all' : 'Pay loans',
         actionTo: onTimePaidLoans.length > 0 ? '/milestones' : '/repay'
      },
      {
         id: 'current-credit-level',
         eyebrow: currentLevel ? 'Unlocked' : 'Locked',
         title: currentLevel ? `Credit level $${currentLevel.amount} unlocked` : 'First credit level locked',
         description: currentLevel?.date ? `Unlocked on ${currentLevel.date}.` : 'Credit level appears after verification.',
         status: currentLevel ? 'unlocked' : 'locked'
      },
      {
         id: 'next-credit-level',
         eyebrow: nextLockedLevel ? 'Next milestone' : 'Unlocked',
         title: nextLockedLevel ? `Reach $${nextLockedLevel.amount} credit level` : 'Maximum credit level reached',
         description: nextLockedLevel?.unlockRequirement || 'All visible credit levels are unlocked.',
         status: nextLockedLevel ? 'next' : 'unlocked',
         actionLabel: nextLockedLevel ? 'View milestones' : 'View all',
         actionTo: '/milestones'
      }
   ];
};

export const buildTrustMilestones = ({
   user,
   borrowerLoans,
   isVerified
}: {
   user: User;
   borrowerLoans: Loan[];
   isVerified: boolean;
}): DashboardMilestone[] => {
   const paidLoans = borrowerLoans.filter((loan) => loan.repaymentStatus === 'Paid');
   const fundedLoans = borrowerLoans.filter((loan) => loan.loanStatus === 'Lent');
   const onTimePaidLoans = getOnTimePaidLoans(borrowerLoans);
   const hasDefaults = borrowerLoans.some(
      (loan) => loan.repaymentStatus === 'Unpaid' && parseDateSafely(loan.dueDate).getTime() < Date.now()
   );

   return [
      {
         id: 'account-created',
         eyebrow: 'Unlocked',
         title: 'Moodeng account created',
         description: user.createdAt ? `Started on ${formatDate(user.createdAt)}.` : 'Your borrower profile is active.',
         status: 'unlocked'
      },
      {
         id: 'identity-verified',
         eyebrow: isVerified ? 'Unlocked' : 'Next milestone',
         title: isVerified ? 'Identity verified' : 'Verify your identity',
         description: isVerified
            ? 'Your account can request borrower credit.'
            : 'Verification unlocks loan requests and credit progression.',
         status: isVerified ? 'unlocked' : 'next',
         actionLabel: isVerified ? undefined : 'Verify now',
         actionTo: isVerified ? undefined : '/verify-world-id'
      },
      {
         id: 'first-funded-loan',
         eyebrow: fundedLoans.length > 0 ? 'Unlocked' : 'Locked',
         title: fundedLoans.length > 0 ? 'First funded loan received' : 'Receive a funded loan',
         description:
            fundedLoans.length > 0
               ? `${fundedLoans.length} funded ${fundedLoans.length === 1 ? 'loan' : 'loans'} in your history.`
               : 'This unlocks when a lender funds one of your requests.',
         status: fundedLoans.length > 0 ? 'unlocked' : 'locked'
      },
      {
         id: 'repayment-track-record',
         eyebrow: onTimePaidLoans.length > 0 ? 'Unlocked' : paidLoans.length > 0 ? 'Needs review' : 'Locked',
         title: onTimePaidLoans.length > 0 ? 'On-time repayment track record' : 'Build repayment history',
         description:
            onTimePaidLoans.length > 0
               ? `${onTimePaidLoans.length} repayments were completed on time.`
               : paidLoans.length > 0
                 ? 'Some repayments are complete; on-time repayment history is still building.'
                 : 'Pay back funded loans to build trust.',
         status: onTimePaidLoans.length > 0 ? 'unlocked' : 'locked'
      },
      {
         id: 'clean-repayment-status',
         eyebrow: hasDefaults ? 'Needs review' : 'Unlocked',
         title: hasDefaults ? 'Resolve overdue loans' : 'No unresolved defaults',
         description: hasDefaults
            ? 'Repay or enter recovery mode before new borrowing continues.'
            : 'No current unresolved defaults are visible.',
         status: hasDefaults ? 'next' : 'unlocked',
         actionLabel: hasDefaults ? 'Repay' : undefined,
         actionTo: hasDefaults ? '/repay' : undefined
      }
   ];
};

export const getNextBorrowerTier = (currentLimit: number) => {
   const next = getNextCreditTier(currentLimit);
   return CREDIT_TIERS.includes(next as (typeof CREDIT_TIERS)[number]) ? next : undefined;
};
