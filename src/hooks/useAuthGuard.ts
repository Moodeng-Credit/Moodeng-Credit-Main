'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

import { useDispatch, useSelector } from 'react-redux';

import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import { clearAuth } from '@/store/slices/authSlice';
import type { RootState } from '@/store/store';

/**
 * Hook to guard protected routes (client-side safety net)
 * - Checks if user is authenticated on mount
 * - If not authenticated, clears state and redirects silently
 * - Middleware handles the primary auth check and redirects
 */
export const useAuthGuard = () => {
   const router = useRouter();
   const dispatch = useDispatch();
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);

   useEffect(() => {
      const isAuthenticated = username && user._id;

      if (!isAuthenticated) {
         console.log('🔒 Client-side auth guard: No authentication found');
         clearAuthCookieClient();
         dispatch(clearAuth());
         router.push('/login');
      }
   }, [username, user._id, router, dispatch]);

   return {
      isAuthenticated: !!(username && user._id),
      user,
      username
   };
};
