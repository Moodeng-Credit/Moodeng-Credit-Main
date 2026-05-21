import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';

import Loading from '@/components/Loading';
import type { RootState } from '@/store/store';

export default function Home() {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);

   const isAuthenticated = !!(user?.id && username);

   if (!isAuthChecked) {
      return <Loading />;
   }

   if (isAuthenticated) {
      return <Navigate to="/request-board" replace />;
   }

   return <Navigate to="/request-board" replace />;
}
