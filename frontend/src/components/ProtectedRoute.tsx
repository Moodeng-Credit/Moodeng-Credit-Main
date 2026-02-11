import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import type { RootState } from '@/store/store';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const location = useLocation();

   const isAuthenticated = !!(username && user?.id);

   if (!isAuthenticated) {
      // Redirect to login but save the current location
      return <Navigate to="/login" state={{ from: location }} replace />;
   }

   return <>{children}</>;
}
