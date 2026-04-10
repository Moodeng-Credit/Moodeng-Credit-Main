import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import type { RootState } from '@/store/store';

interface RoleGuardProps {
   children: React.ReactNode;
}

export function RoleGuard({ children }: RoleGuardProps) {
   const user = useSelector((state: RootState) => state.auth.user);

   if (user?.id && !user.userRole) {
      return <Navigate to="/role-selection" replace />;
   }

   return <>{children}</>;
}
