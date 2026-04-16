import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { clearAuth, fetchUser, setAuthChecked } from '@/store/slices/authSlice';
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
         dispatch(setAuthChecked());
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

               // Redirect to request board (public landing) if they were previously authenticated
               if (wasAuthenticated && location.pathname !== '/sign-in' && location.pathname !== '/request-board') {
                  navigate('/request-board');
               }
            }
         }
      });

      // Initial session check
      supabase.auth.getSession().then(async ({ data: { session }, error: sessionError }) => {
         if (sessionError || !session) {
            // No valid session — try to clear stale persisted state
            clearAuthCookieClient();
            dispatch(clearAuth());
            dispatch(setAuthChecked());
            return;
         }

         // Session exists — try refresh if expired, then fetch user
         try {
            const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser();

            if (userError || !supabaseUser) {
               // Session invalid — try refreshing
               const { error: refreshError } = await supabase.auth.refreshSession();
               if (refreshError) {
                  clearAuthCookieClient();
                  dispatch(clearAuth());
                  dispatch(setAuthChecked());
                  return;
               }
            }

            await dispatch(fetchUser()).unwrap();
         } catch {
            clearAuthCookieClient();
            dispatch(clearAuth());
         } finally {
            dispatch(setAuthChecked());
         }
      });

      return () => {
         subscription.unsubscribe();
      };
   }, [dispatch, navigate, location.pathname, wasAuthenticated]);

   return null;
}
