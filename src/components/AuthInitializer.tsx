import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { clearAuth, fetchUser } from '@/store/slices/authSlice';
import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import type { AppDispatch } from '@/store/store';

export function AuthInitializer() {
   const dispatch = useDispatch<AppDispatch>();
   const supabase = getSupabaseBrowserClient();

   useEffect(() => {
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
         } else if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
            if (!session) {
               console.log('🔒 Session cleared, updating Redux state');
               clearAuthCookieClient();
               dispatch(clearAuth());
            }
         }
      });

      // Initial check
      supabase.auth.getUser().then(({ data: { user }, error }) => {
         if (error || !user) {
            console.log('🔒 Initial auth check failed or no user found, clearing auth');
            clearAuthCookieClient();
            dispatch(clearAuth());
         } else {
            dispatch(fetchUser()).catch((err) => {
               console.error('Failed to fetch user profile on initial check:', err);
            });
         }
      });

      return () => {
         subscription.unsubscribe();
      };
   }, [dispatch, supabase]);

   return null;
}
