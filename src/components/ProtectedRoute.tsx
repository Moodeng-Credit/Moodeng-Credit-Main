import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import type { RootState } from '@/store/store';

interface ProtectedRouteProps {
   children: React.ReactNode;
}

const ONBOARDING_ROLE_PATH = '/onboarding/role';
const ONBOARDING_WELCOME_PATH = '/onboarding/welcome';

/**
 * Requires Supabase session + profile in Redux (after `bootstrapSession`).
 * Users without `user_role` may only access onboarding routes until they complete role selection.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const location = useLocation();

   const isAuthenticated = !!(username && user?.id);
   if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
   }

   const needsRole = !user.userRole;
   const path = location.pathname;

   if (needsRole) {
      if (path.startsWith(ONBOARDING_WELCOME_PATH)) {
         return <Navigate to={ONBOARDING_ROLE_PATH} replace />;
      }
      if (!path.startsWith(ONBOARDING_ROLE_PATH)) {
         return <Navigate to={ONBOARDING_ROLE_PATH} replace />;
      }
   } else if (path === ONBOARDING_ROLE_PATH) {
      return <Navigate to="/dashboard" replace />;
   }

   return <>{children}</>;
}
