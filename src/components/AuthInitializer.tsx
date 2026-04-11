import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { clearAuth, fetchUser } from '@/store/slices/authSlice';
import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import type { AppDispatch, RootState } from '@/store/store';

export function AuthInitializer() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const location = useLocation();

   // Get current auth state from Redux (might be persisted)
   const { user, username } = useSelector((state: RootState) => state.auth);
   const wasAuthenticated = !!(user?.id && username);

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

      // Listen for auth state changes
      const {
         data: { subscription }
      } = supabase.auth.onAuthStateChange(async (event, session) => {
         console.log(`🔔 Supabase Auth Event: ${event}`);

         if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
               // Sync user data to Redux if needed
               dispatch(fetchUser()).catch((err) => {
                  console.error('Failed to fetch user profile on auth change:', err);
               });
            }
         } else if (event === 'SIGNED_OUT') {
            if (!session) {
               console.log('🔒 Session cleared, updating Redux state');
               clearAuthCookieClient();
               dispatch(clearAuth());

               // Redirect to login if they were previously authenticated and not already on login page
               if (wasAuthenticated && location.pathname !== '/sign-in') {
                  navigate('/sign-in');
               }
            }
         }
      });

      // Initial check
      supabase.auth.getUser().then(({ data: { user: supabaseUser }, error }) => {
         if (error || !supabaseUser) {
            console.log('🔒 Initial auth check failed or no user found, clearing auth');
            clearAuthCookieClient();
            dispatch(clearAuth());

            // If we thought we were authenticated (persisted state) but Supabase says no,
            // redirect to login (unless already there)
            if (wasAuthenticated && location.pathname !== '/sign-in') {
               navigate('/sign-in');
            }
         } else {
            dispatch(fetchUser()).catch((err) => {
               console.error('Failed to fetch user profile on initial check:', err);
            });
         }
      });

      return () => {
         subscription.unsubscribe();
      };
   }, [dispatch, navigate, location.pathname, wasAuthenticated]);

   return null;
}
