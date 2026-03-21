import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import type { RootState } from '@/store/store';

interface ProtectedRouteProps {
   children: React.ReactNode;
   /** When true, redirects to /select-role if user has no user_role */
   requiresRole?: boolean;
}

export function ProtectedRoute({ children, requiresRole = false }: ProtectedRouteProps) {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const location = useLocation();

   const isAuthenticated = !!(username && user?.id);

   if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
   }

   if (requiresRole && !user?.userRole) {
      return <Navigate to="/select-role" state={{ from: location }} replace />;
   }

   return <>{children}</>;
}
