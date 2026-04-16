import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import MainLandingPage from '@/views/landing/MainLandingPage';
import type { RootState } from '@/store/store';

export default function Home() {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);

   if (!isAuthChecked) {
      return <MainLandingPage />;
   }

   const isAuthenticated = !!(user?.id && username);
   if (isAuthenticated) {
      const target = user.userRole === 'lender' ? '/lender/dashboard' : '/dashboard';
      return <Navigate to={target} replace />;
   }

   return <MainLandingPage />;
}
