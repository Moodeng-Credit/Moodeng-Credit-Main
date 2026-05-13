import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import type { RootState } from '@/store/store';

export default function LenderDiversityInsights() {
   const location = useLocation();
   const user = useSelector((state: RootState) => state.auth.user);
   const username = user?.username;

   if (!username) {
      return <Navigate to="/dashboard" replace />;
   }

   return <Navigate to={`/user/${encodeURIComponent(username)}/lender-diversity${location.search}`} replace />;
}
