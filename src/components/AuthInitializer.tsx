import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';

import { getPostAuthEntryPath } from '@/lib/auth/navigation';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { clearAuth, fetchUser } from '@/store/slices/authSlice';
import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import type { AppDispatch, RootState } from '@/store/store';

const AUTH_LANDING_PATHS = ['/login', '/signup'];

/**
 * Subscribes to Supabase auth events and keeps Redux in sync after initial `bootstrapSession`.
 */
export function AuthInitializer() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const location = useLocation();
   const { user, username, sessionBootstrapStatus } = useSelector((state: RootState) => state.auth);
   const wasAuthenticatedRef = useRef(!!(user?.id && username));

   useEffect(() => {
      wasAuthenticatedRef.current = !!(user?.id && username);
   }, [user?.id, username]);

   useEffect(() => {
      if (!isSupabaseBrowserConfigured()) {
         if (import.meta.env.DEV) {
            console.warn(
               '[AuthInitializer] Supabase not configured (env encrypted or missing). Auth sync disabled. Use `pnpm run dev` with dotenvx + .env.keys.'
            );
         }
         return;
      }

      const supabase = getSupabaseBrowserClient();

      const {
         data: { subscription }
      } = supabase.auth.onAuthStateChange(async (event, session) => {
         if (import.meta.env.DEV) {
            console.log(`[AuthInitializer] Supabase event: ${event}`);
         }

         if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
               dispatch(fetchUser()).catch((err) => {
                  console.error('Failed to fetch user profile on auth change:', err);
               });
            }
            return;
         }

         if (event === 'SIGNED_OUT') {
            if (!session) {
               clearAuthCookieClient();
               dispatch(clearAuth());
               if (wasAuthenticatedRef.current && !AUTH_LANDING_PATHS.includes(location.pathname)) {
                  navigate('/login', { replace: true });
               }
            }
         }
      });

      return () => {
         subscription.unsubscribe();
      };
   }, [dispatch, navigate, location.pathname]);

   /** Logged-in users opening Sign In / Sign Up land in the right app entry. */
   useEffect(() => {
      if ((sessionBootstrapStatus ?? 'pending') !== 'ready') return;
      const authed = !!(user?.id && username);
      if (!authed) return;
      const path = location.pathname;
      if (!AUTH_LANDING_PATHS.includes(path)) return;

      navigate(getPostAuthEntryPath(user), { replace: true });
   }, [sessionBootstrapStatus, user, username, location.pathname, navigate]);

   return null;
}
