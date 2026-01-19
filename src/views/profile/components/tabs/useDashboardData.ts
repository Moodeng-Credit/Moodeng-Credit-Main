import { useEffect, useMemo } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { CREDIT_STEP, CREDIT_TIERS, MAX_CREDIT_LIMIT, getEffectiveCreditLimit } from '@/lib/creditLeveling';
import { formatDate, parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { fetchUser } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import type { CreditLevel, RoleType, StatsData } from '@/views/profile/components/tabs/types';

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

   const paidOnTimeByAmount = new Map<number, Loan>();
   [...onTimePaidLoans]
      .sort((a, b) => parseDateSafely(a.updatedAt).getTime() - parseDateSafely(b.updatedAt).getTime())
      .forEach((loan) => {
         if (!paidOnTimeByAmount.has(loan.loanAmount)) {
            paidOnTimeByAmount.set(loan.loanAmount, loan);
         }
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
            const triggeringLoan = paidOnTimeByAmount.get(amount - CREDIT_STEP);
            date = buildUnlockDate(triggeringLoan?.updatedAt) ?? fallbackDate;
         }
         requestable = isCurrentLimit;
      } else if (isPaused) {
         unlockRequirement = 'Progression Paused (Late Repayment)';
         date = undefined;
      } else if (isNextTier) {
         unlockRequirement = `Fully repay $${currentLimit} on time to unlock this level`;
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

   const creditLevels: CreditLevel[] = useMemo(() => buildCreditLevels({ user, loans: userLoans }), [user, userLoans]);

   return { stats, lenderDiversityScore, creditLevels, loanArrays };
};
