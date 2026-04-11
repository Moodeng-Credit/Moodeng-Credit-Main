import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import type { RootState } from '@/store/store';

interface ProtectedRouteProps {
   children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const location = useLocation();

   const isAuthenticated = !!(username && user?.id);

   if (!isAuthenticated) {
      return <Navigate to="/sign-in" state={{ from: location }} replace />;
   }

   return <>{children}</>;
}
