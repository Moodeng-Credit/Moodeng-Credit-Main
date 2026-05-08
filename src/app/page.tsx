import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { LoanStatus, RepaymentStatus } from '@/types/loanTypes';

export default function Home() {
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const [hasCheckedBorrowerLoans, setHasCheckedBorrowerLoans] = useState(false);
   const [hasActiveBorrowerLoan, setHasActiveBorrowerLoan] = useState(false);

   const isAuthenticated = !!(user?.id && username);

   useEffect(() => {
      if (!isAuthChecked || !isAuthenticated || user.userRole === 'lender') {
         setHasCheckedBorrowerLoans(false);
         setHasActiveBorrowerLoan(false);
         return;
      }

      let cancelled = false;
      setHasCheckedBorrowerLoans(false);

      dispatch(getUserLoans({ userId: user.id }))
         .unwrap()
         .then((loans) => {
            if (cancelled) return;
            setHasActiveBorrowerLoan(
               loans.some(
                  (loan) =>
                     loan.borrowerUser === user.id &&
                     loan.loanStatus === LoanStatus.LENT &&
                     loan.repaymentStatus !== RepaymentStatus.PAID
               )
            );
         })
         .catch(() => {
            if (!cancelled) setHasActiveBorrowerLoan(false);
         })
         .finally(() => {
            if (!cancelled) setHasCheckedBorrowerLoans(true);
         });

      return () => {
         cancelled = true;
      };
   }, [dispatch, isAuthChecked, isAuthenticated, user.id, user.userRole]);

   if (!isAuthChecked) {
      return <div className="min-h-screen bg-md-neutral-200" />;
   }

   if (isAuthenticated) {
      if (user.userRole === 'lender') {
         return <Navigate to="/request-board" replace />;
      }

      if (!hasCheckedBorrowerLoans) {
         return <div className="min-h-screen bg-md-neutral-200" />;
      }

      return <Navigate to={hasActiveBorrowerLoan ? '/dashboard' : '/request-board'} replace />;
   }

   return <Navigate to="/request-board" replace />;
}
