import { useEffect } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import { clearAuth } from '@/store/slices/authSlice';
import type { RootState } from '@/store/store';

/**
 * Hook to guard protected routes (client-side safety net)
 * - Checks if user is authenticated on mount
 * - If not authenticated, clears state and redirects silently
 */
export const useAuthGuard = () => {
   const navigate = useNavigate();
   const dispatch = useDispatch();
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);

   useEffect(() => {
      const isAuthenticated = username && user?.id;

      if (!isAuthenticated) {
         console.log('🔒 Client-side auth guard: No authentication found');
         clearAuthCookieClient();
         dispatch(clearAuth());
         navigate('/request-board');
      }
   }, [username, user?.id, navigate, dispatch]);

   return {
      isAuthenticated: !!(username && user?.id),
      user,
      username
   };
};
