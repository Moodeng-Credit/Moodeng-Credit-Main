import { useEffect, useMemo } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { CREDIT_STEP, CREDIT_TIERS, MAX_CREDIT_LIMIT, getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { formatDate, parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { fetchUser } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { CreditLevel, Milestone, RoleType, StatsData } from '@/views/profile/components/tabs/types';

import type { Loan } from '@/types/loanTypes';
import type { User } from '@/types/authTypes';

type CreditLevelInput = {
   user: User;
   loans: Loan[];
};

const buildUnlockDate = (date?: string | null): string | undefined => {
   if (!date) return undefined;
   return formatDate(date);
};

export const buildCreditLevels = ({ user, loans }: CreditLevelInput): CreditLevel[] => {
   const isVerified = user.isWorldId === 'ACTIVE';
   const currentLimit = getEffectiveCreditLimit(user.cs, isVerified);
   const isPaused = Boolean(user.creditProgressionPaused);
   const paidLoans = loans.filter((loan) => loan.repaymentStatus === 'Paid');
   const onTimePaidLoans = paidLoans.filter((loan) => {
      const repaidAmount = toNumber(loan.repaidAmount);
      const totalRepayment = toNumber(loan.totalRepaymentAmount);
      const isFullyRepaid = totalRepayment > 0 ? repaidAmount >= totalRepayment : repaidAmount > 0;
      const paidAt = parseDateSafely(loan.updatedAt);
      const dueDate = parseDateSafely(loan.dueDate);
      return isFullyRepaid && paidAt.getTime() <= dueDate.getTime();
   });

   const paidOnTimeByTier = new Map<number, Loan>();
   let cumulativeRepaidAmount = 0;
   [...onTimePaidLoans]
      .sort((a, b) => parseDateSafely(a.updatedAt).getTime() - parseDateSafely(b.updatedAt).getTime())
      .forEach((loan) => {
         cumulativeRepaidAmount += toNumber(loan.loanAmount);
         CREDIT_TIERS.forEach((tier) => {
            if (tier === CREDIT_TIERS[0] || paidOnTimeByTier.has(tier)) {
               return;
            }

            if (cumulativeRepaidAmount >= tier) {
               paidOnTimeByTier.set(tier, loan);
            }
         });
      });

   const fallbackDate = buildUnlockDate(user.updatedAt || user.createdAt || new Date().toISOString());

   return CREDIT_TIERS.map((amount) => {
      const isUnlocked = isVerified && amount <= currentLimit;
      const isCurrentLimit = isVerified && amount === currentLimit;
      const isNextTier = isVerified && amount === currentLimit + CREDIT_STEP && currentLimit < MAX_CREDIT_LIMIT;
      const isMaxCredit = isUnlocked && amount === MAX_CREDIT_LIMIT;

      let unlockRequirement = '';
      let date: string | undefined = fallbackDate;
      let requestable = false;

      if (!isVerified) {
         unlockRequirement = 'Verify World ID to start borrowing';
         date = undefined;
      } else if (isUnlocked) {
         if (amount === CREDIT_TIERS[0]) {
            date = buildUnlockDate(user.createdAt) ?? fallbackDate;
         } else {
            const triggeringLoan = paidOnTimeByTier.get(amount);
            date = buildUnlockDate(triggeringLoan?.updatedAt) ?? fallbackDate;
         }
         requestable = isCurrentLimit;
      } else if (isPaused) {
         unlockRequirement = 'Progression Paused (Late Repayment)';
         date = undefined;
      } else if (isNextTier) {
         unlockRequirement = `Fully repay $${currentLimit} total on time to unlock this level`;
         date = undefined;
      } else {
         unlockRequirement = 'Locked';
         date = undefined;
      }

      return {
         id: `tier-${amount}`,
         amount,
         unlocked: isUnlocked,
         date,
         unlockRequirement,
         isMaxCredit,
         requestable,
         progressionPaused: isPaused
      };
   });
};

export const useDashboardData = (activeRole: RoleType) => {
   const dispatch = useDispatch<AppDispatch>();
   const userId = useSelector((state: RootState) => state.auth.user.id);
   const user = useSelector((state: RootState) => state.auth.user);
   const gloanRequests = useSelector((state: RootState) => state.loans.loans.gloans || []);

   useEffect(() => {
      const fetchData = async () => {
         if (userId) {
            await dispatch(getUserLoans({ userId }));
            await dispatch(fetchUser());
         }
      };
      fetchData();
   }, [dispatch, userId]);

   const userLoans = useMemo(() => {
      return gloanRequests.filter((loan) => (activeRole === 'borrower' ? loan.borrowerUser === userId : loan.lenderUser === userId));
   }, [gloanRequests, activeRole, userId]);

   const borrowerLoans = useMemo(() => {
      return gloanRequests.filter((loan) => loan.borrowerUser === userId);
   }, [gloanRequests, userId]);

   const loanArrays = useMemo(() => {
      const repayments = userLoans.filter((loan) => loan.repaymentStatus === 'Paid');
      const activeLoans = userLoans.filter((loan) => loan.loanStatus === 'Lent' && loan.repaymentStatus === 'Unpaid');
      const defaultedLoans = userLoans.filter(
         (loan) => loan.repaymentStatus === 'Unpaid' && parseDateSafely(loan.dueDate).getTime() < Date.now()
      );
      const pendingLoans = userLoans.filter((loan) => loan.loanStatus === 'Requested');

      return { repayments, activeLoans, defaultedLoans, pendingLoans };
   }, [userLoans]);

   const stats: StatsData = useMemo(() => {
      return {
         repayments: {
            count: loanArrays.repayments.length,
            total: loanArrays.repayments.reduce((sum, loan) => sum + toNumber(loan.repaidAmount), 0)
         },
         active: {
            count: loanArrays.activeLoans.length,
            total: loanArrays.activeLoans.reduce((sum, loan) => sum + toNumber(loan.loanAmount), 0)
         },
         defaulted: {
            count: loanArrays.defaultedLoans.length,
            total: loanArrays.defaultedLoans.reduce((sum, loan) => sum + toNumber(loan.loanAmount), 0)
         },
         pending: {
            count: loanArrays.pendingLoans.length,
            total: loanArrays.pendingLoans.reduce((sum, loan) => sum + toNumber(loan.loanAmount), 0)
         }
      };
   }, [loanArrays]);

   const lenderDiversityScore = useMemo(() => {
      if (activeRole === 'lender') return 0;
      const uniqueLenders = new Set(userLoans.filter((loan) => loan.lenderUser).map((loan) => loan.lenderUser));
      return Math.min(100, uniqueLenders.size * 10);
   }, [userLoans, activeRole]);

   const creditLevels: CreditLevel[] = useMemo(() => buildCreditLevels({ user, loans: borrowerLoans }), [user, borrowerLoans]);

   const trustScore: number = useMemo(() => calculateTrustScore(user, borrowerLoans), [user, borrowerLoans]);

   const milestones: Milestone[] = useMemo(() => buildMilestones(borrowerLoans), [borrowerLoans]);

   return { stats, lenderDiversityScore, creditLevels, loanArrays, trustScore, milestones };
};

// ─── Trust Score ────────────────────────────────────────────────────────────

export type TrustScoreLabel = 'Poor' | 'Fair' | 'Good Standing' | 'Excellent';

export interface TrustScoreInfo {
   label: TrustScoreLabel;
   color: string;
}

export const getTrustScoreInfo = (score: number): TrustScoreInfo => {
   if (score < 40) return { label: 'Poor', color: '#ef4444' };
   if (score < 70) return { label: 'Fair', color: '#f97316' };
   if (score < 90) return { label: 'Good Standing', color: '#22c55e' };
   return { label: 'Excellent', color: '#10b981' };
};

export const calculateTrustScore = (user: User, loans: Loan[]): number => {
   let score = 50;

   if (user.isWorldId === 'ACTIVE') {
      score += 10;
   }

   for (const loan of loans) {
      if (loan.repaymentStatus === 'Paid') {
         const paidAt = parseDateSafely(loan.updatedAt);
         const dueDate = parseDateSafely(loan.dueDate);
         if (paidAt.getTime() <= dueDate.getTime()) {
            score += 5;
         }
      } else if (loan.repaymentStatus === 'Unpaid' && parseDateSafely(loan.dueDate).getTime() < Date.now()) {
         score -= 10;
      }
   }

   return Math.min(100, Math.max(0, score));
};

// ─── Milestones ──────────────────────────────────────────────────────────────

interface MilestoneDefinition {
   id: string;
   title: string;
   description: string;
   requiredOnTimeRepayments: number;
}

const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
   {
      id: 'repay_1',
      title: 'Repay a loan on time',
      description: 'Increase your Trust Level',
      requiredOnTimeRepayments: 1
   },
   {
      id: 'repay_2',
      title: 'Repay one more loan on time',
      description: 'Complete a full repayment to unlock',
      requiredOnTimeRepayments: 2
   },
   {
      id: 'repay_5',
      title: 'Repay 5 loans on time',
      description: 'Complete a full repayment to unlock',
      requiredOnTimeRepayments: 5
   }
];

export const buildMilestones = (loans: Loan[]): Milestone[] => {
   const onTimeCount = loans.filter((loan) => {
      if (loan.repaymentStatus !== 'Paid') return false;
      const paidAt = parseDateSafely(loan.updatedAt);
      const dueDate = parseDateSafely(loan.dueDate);
      return paidAt.getTime() <= dueDate.getTime();
   }).length;

   let nextAssigned = false;

   return MILESTONE_DEFINITIONS.map((def) => {
      if (onTimeCount >= def.requiredOnTimeRepayments) {
         return { id: def.id, title: def.title, description: def.description, status: 'completed' as const };
      }
      if (!nextAssigned) {
         nextAssigned = true;
         return { id: def.id, title: def.title, description: def.description, status: 'next' as const };
      }
      return { id: def.id, title: def.title, description: def.description, status: 'locked' as const };
   });
};
