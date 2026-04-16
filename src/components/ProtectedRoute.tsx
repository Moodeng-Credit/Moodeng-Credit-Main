import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import Loading from '@/components/Loading';
import type { RootState } from '@/store/store';

interface ProtectedRouteProps {
   children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const location = useLocation();

   if (!isAuthChecked) {
      return <Loading />;
   }

   const isAuthenticated = !!(username && user?.id);

   if (!isAuthenticated) {
      return <Navigate to="/sign-in" state={{ from: location }} replace />;
   }

   return <>{children}</>;
}
