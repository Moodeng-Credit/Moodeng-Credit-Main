import { useEffect, useMemo } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { fetchUser } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { getCreditMilestoneDetails } from '@/views/profile/components/tabs/helpers';
import type { CreditLevel, RoleType, StatsData } from '@/views/profile/components/tabs/types';

export const useDashboardData = (activeRole: RoleType) => {
   const dispatch = useDispatch<AppDispatch>();
   const username = useSelector((state: RootState) => state.auth.username);
   const gloanRequests = useSelector((state: RootState) => state.loans.loans.gloans || []);

   useEffect(() => {
      const fetchData = async () => {
         if (username) {
            await dispatch(getUserLoans(username));
            await dispatch(fetchUser());
         }
      };
      fetchData();
   }, [dispatch, username]);

   const userLoans = useMemo(() => {
      return gloanRequests.filter((loan) => (activeRole === 'borrower' ? loan.borrowerUser === username : loan.lenderUser === username));
   }, [gloanRequests, activeRole, username]);

   const loanArrays = useMemo(() => {
      const repayments = userLoans.filter((loan) => loan.repaymentStatus === 'Paid');
      const activeLoans = userLoans.filter((loan) => loan.loanStatus === 'Lent' && loan.repaymentStatus === 'Unpaid');
      const defaultedLoans = userLoans.filter(
         (loan) => loan.repaymentStatus === 'Unpaid' && parseDateSafely(loan.createdAt).getTime() + loan.days * 86400000 < Date.now()
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

   const creditLevels: CreditLevel[] = useMemo(() => {
      const completedLoans = stats.repayments.total;

      const levelsList = Array.from({ length: stats.repayments.count + 6 }, (_, i) => {
         const level = (i + 1) * 20;;
         return {
            id: `level-${level}`,
            amount: level
         }
      });

      const maxLevelIndex = completedLoans >= 20 ? levelsList.findIndex(item => item.amount >= completedLoans) : -1;

      return levelsList.map((level, index) => {
         const prev = levelsList[index - 1];
         return {
            isMaxCredit: maxLevelIndex === index,
            ...level,
            ...getCreditMilestoneDetails(level.amount, completedLoans, loanArrays.repayments),
             ...(index > maxLevelIndex && {
               unlockRequirement: `Repay a $${prev?.amount || 20} Loan\nto Unlock this Level`,
               hasRequestButton: maxLevelIndex + 1 === index,
            })
         }
      });
   }, [loanArrays.repayments, stats.repayments.total, stats.repayments.count]);

   return { stats, lenderDiversityScore, creditLevels, loanArrays };
};
