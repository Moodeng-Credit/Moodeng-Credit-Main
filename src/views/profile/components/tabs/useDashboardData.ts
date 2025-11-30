import { useEffect, useMemo } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { parseDateSafely } from '@/utils/dateFormatters';
import { toNumber } from '@/utils/decimalHelpers';

import { fetchUser } from '@/store/slices/authSlice';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
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
      const completedLoans = stats.repayments.count;
      return [
         {
            id: 'level-60',
            unlocked: completedLoans >= 1,
            amount: 60,
            date: 'March 02 2025',
            lender: 'Lender_4000',
            reason: 'Need to buy\nBooks for School',
            repayTime: '3 DAYS TO REPAY'
         },
         {
            id: 'level-80',
            unlocked: completedLoans >= 2,
            amount: 80,
            date: 'March 02 2025',
            lender: 'Lender Name',
            reason: 'Unexpected car repair,\nwaiting for reimbursement',
            repayTime: '1 WEEK TO REPAY'
         },
         {
            id: 'level-100',
            unlocked: completedLoans >= 3,
            amount: 100,
            date: 'March 01 2025',
            isMaxCredit: true
         },
         {
            id: 'level-120',
            unlocked: false,
            amount: 120,
            unlockRequirement: 'Repay a $100 Loan\nto Unlock this Level',
            hasRequestButton: true
         },
         {
            id: 'level-140',
            unlocked: false,
            amount: 140,
            unlockRequirement: 'Repay a $120 Loan\nto Unlock this Level'
         }
      ];
   }, [stats.repayments.count]);

   return { stats, lenderDiversityScore, creditLevels, loanArrays };
};
