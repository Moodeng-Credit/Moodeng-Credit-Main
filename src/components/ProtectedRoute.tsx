import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import Loading from '@/components/Loading';
import { useDefaultedBorrowerSupport } from '@/hooks/useDefaultedBorrowerSupport';
import type { RootState } from '@/store/store';

interface ProtectedRouteProps {
   children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const location = useLocation();
   const defaultedBorrower = useDefaultedBorrowerSupport(isAuthChecked ? user?.id : null);
   const canRepayWhileDefaulted = defaultedBorrower.support.overdueAmount > 0 && location.pathname === '/repay';

   if (!isAuthChecked) {
      return <Loading />;
   }

   const isAuthenticated = !!(username && user?.id);

   if (!isAuthenticated) {
      return <Navigate to="/sign-in" state={{ from: location }} replace />;
   }

   if ((user.accountStatus === 'blocked' || user.accountStatus === 'banned') && location.pathname !== '/account-restricted') {
      return <Navigate to="/account-restricted" replace />;
   }

   if (
      defaultedBorrower.support.overdueAmount > 0 &&
      !canRepayWhileDefaulted &&
      location.pathname !== '/account-restricted'
   ) {
      return <Navigate to="/account-restricted" replace />;
   }

   return <>{children}</>;
}
