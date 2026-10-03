import { useEffect, useMemo, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { formatDate } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';
import { isLoanPastDue } from '@/utils/loanOverdue';
import { calculateLenderDiversity } from '@/utils/diversityScore';

import { getNextCreditTier } from '@/config/creditTiers';
import { CREDIT_TIERS, getEffectiveCreditLimit, getFullLimitLoans, MAX_CREDIT_LIMIT } from '@/lib/creditLeveling';
import { isUserVerified } from '@/lib/isUserVerified';
import { fetchUser } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import type { Loan } from '@/types/loanTypes';
import type { CreditLevel, RoleType, StatsData } from '@/views/profile/components/tabs/types';

type CreditLevelInput = {
   user: User;
   loans: Loan[];
};

const DASHBOARD_REFRESH_INTERVAL_MS = 30_000;

const buildUnlockDate = (date?: string | null): string | undefined => {
   if (!date) return undefined;
   return formatDate(date);
};

export const buildCreditLevels = ({ user, loans }: CreditLevelInput): CreditLevel[] => {
   const isVerified = isUserVerified(user);
   const currentLimit = getEffectiveCreditLimit(user.cs, isVerified);
   // Date each tier by the full-limit loan that unlocked it (same rule and recorded limits as leveling).
   // Tiers raised any other way (referral, admin) fall back to a generic date.
   const unlockedByTier = new Map<number, Loan>();
   getFullLimitLoans(loans).forEach((limitBefore, loan) => {
      if (limitBefore < MAX_CREDIT_LIMIT) unlockedByTier.set(getNextCreditTier(limitBefore), loan);
   });

   const fallbackDate = buildUnlockDate(user.updatedAt || user.createdAt || new Date().toISOString());

   return CREDIT_TIERS.map((amount) => {
      const isUnlocked = isVerified && amount <= currentLimit;
      const isCurrentLimit = isVerified && amount === currentLimit;
      const isNextTier = isVerified && amount === getNextCreditTier(currentLimit) && currentLimit < MAX_CREDIT_LIMIT;
      const isMaxCredit = isUnlocked && amount === MAX_CREDIT_LIMIT;

      let unlockRequirement = '';
      let date: string | undefined = fallbackDate;
      let requestable = false;

      if (!isVerified) {
         unlockRequirement = 'Verify your identity to start borrowing';
         date = undefined;
      } else if (isUnlocked) {
         if (amount === CREDIT_TIERS[0]) {
            date = buildUnlockDate(user.createdAt) ?? fallbackDate;
         } else {
            const triggeringLoan = unlockedByTier.get(amount);
            date = buildUnlockDate(triggeringLoan?.repaidAt ?? triggeringLoan?.updatedAt) ?? fallbackDate;
         }
         requestable = isCurrentLimit;
      } else if (isNextTier) {
         unlockRequirement = `Borrow & repay the full $${currentLimit} to unlock`;
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
         requestable
      };
   });
};

export const useDashboardData = (activeRole: RoleType) => {
   const dispatch = useDispatch<AppDispatch>();
   const userId = useSelector((state: RootState) => state.auth.user.id);
   const user = useSelector((state: RootState) => state.auth.user);
   const gloanRequests = useSelector((state: RootState) => state.loans.loans.gloans || []);
   const userLoansFetchedFor = useSelector((state: RootState) => state.loans.userLoansFetchedFor);
   const userLoansFetchedAt = useSelector((state: RootState) => state.loans.userLoansFetchedAt);

   const userLoans = useMemo(() => {
      return gloanRequests.filter((loan) => (activeRole === 'borrower' ? loan.borrowerUser === userId : loan.lenderUser === userId));
   }, [gloanRequests, activeRole, userId]);

   const borrowerLoans = useMemo(() => {
      return gloanRequests.filter((loan) => loan.borrowerUser === userId);
   }, [gloanRequests, userId]);

   const hasCachedDashboardData = userLoansFetchedFor === userId || userLoans.length > 0;
   const hasFreshDashboardData =
      userLoansFetchedFor === userId && userLoansFetchedAt !== null && Date.now() - userLoansFetchedAt < DASHBOARD_REFRESH_INTERVAL_MS;
   const [isReady, setIsReady] = useState(() => Boolean(userId && hasCachedDashboardData));

   useEffect(() => {
      if (!userId) {
         setIsReady(false);
         return;
      }

      if (hasCachedDashboardData) {
         setIsReady(true);
      } else {
         setIsReady(false);
      }

      if (hasFreshDashboardData) {
         return;
      }

      let cancelled = false;

      const refreshData = async () => {
         await Promise.allSettled([dispatch(getUserLoans({ userId })).unwrap(), dispatch(fetchUser()).unwrap()]);

         if (!cancelled) {
            setIsReady(true);
         }
      };

      void refreshData();

      return () => {
         cancelled = true;
      };
   }, [dispatch, hasCachedDashboardData, hasFreshDashboardData, userId]);

   const loanArrays = useMemo(() => {
      const repayments = userLoans.filter((loan) => loan.repaymentStatus === 'Paid' && !loan.refundedAt);
      // Partly repaid loans are still active (and can still be overdue).
      const activeLoans = userLoans.filter((loan) => loan.loanStatus === 'Lent' && loan.repaymentStatus !== 'Paid' && !loan.refundedAt);
      // Only a funded loan can be overdue: a request nobody funded has nothing to repay. Past due at
      // the same moment as everywhere else (src/utils/loanOverdue.ts), not at midnight UTC.
      const defaultedLoans = activeLoans.filter((loan) => isLoanPastDue(loan.dueDate, new Date(), loan.dueTimezone));
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
      const fundedLoans = userLoans.filter((loan) => loan.loanStatus === 'Lent');
      return calculateLenderDiversity(fundedLoans).score;
   }, [userLoans, activeRole]);

   const creditLevels: CreditLevel[] = useMemo(() => buildCreditLevels({ user, loans: borrowerLoans }), [user, borrowerLoans]);

   return { stats, lenderDiversityScore, creditLevels, loanArrays, isReady };
};
