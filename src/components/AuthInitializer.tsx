import { useEffect, useRef } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { clearAuthCookieClient } from '@/lib/utils/cookieConfig';
import { clearAuth, fetchUser, setAuthChecked, setPreviewAuth } from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

// Pages that run their own auth/session flow. A SIGNED_OUT event on these (e.g. the
// deliberate session purge before a fresh signup) must NOT bounce the user to
// /request-board mid-flow.
const AUTH_FLOW_PATHS = new Set(['/sign-in', '/sign-up', '/request-board', '/forgot-password', '/reset-password']);

// Minimum gap between focus-triggered profile refreshes. Without this, server-side
// changes (e.g. a Didit webhook approving the user) stay invisible until the hourly
// token refresh — users saw stale "unverified" state long after approval.
const FOCUS_REFRESH_MIN_INTERVAL_MS = 60_000;

export function AuthInitializer() {
   const dispatch = useDispatch<AppDispatch>();
   const navigate = useNavigate();
   const location = useLocation();

   const { user, username } = useSelector((state: RootState) => state.auth);
   const wasAuthenticated = !!(user?.id && username);

   // Latest values for the post-sign-out redirect, read from inside the subscription.
   const wasAuthenticatedRef = useRef(wasAuthenticated);
   const pathnameRef = useRef(location.pathname);

   useEffect(() => {
      wasAuthenticatedRef.current = wasAuthenticated;
      pathnameRef.current = location.pathname;
   }, [wasAuthenticated, location.pathname]);

   // Refresh the profile when the tab regains focus so server-side changes (webhook
   // verification approvals, admin edits) show up without a manual reload. Throttled
   // so rapid tab switching doesn't spam the API.
   const lastFocusRefreshRef = useRef(0);
   useEffect(() => {
      if (!isSupabaseBrowserConfigured()) return;

      const onFocus = () => {
         if (document.visibilityState !== 'visible') return;
         if (!wasAuthenticatedRef.current) return;
         const now = Date.now();
         if (now - lastFocusRefreshRef.current < FOCUS_REFRESH_MIN_INTERVAL_MS) return;
         lastFocusRefreshRef.current = now;
         dispatch(fetchUser()).catch(() => {
            // Transient network failure — the next focus or token refresh will retry.
         });
      };

      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onFocus);
      return () => {
         window.removeEventListener('focus', onFocus);
         document.removeEventListener('visibilitychange', onFocus);
      };
   }, [dispatch]);

   // Subscription + initial session check — runs once.
   useEffect(() => {
      const previewAuth = new URLSearchParams(window.location.search).get('previewAuth');
      if (import.meta.env.DEV && previewAuth) {
         dispatch(setPreviewAuth(previewAuth));
         return;
      }

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

      const {
         data: { subscription }
      } = supabase.auth.onAuthStateChange(async (event, session) => {
         if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (session?.user) {
               dispatch(fetchUser()).catch((err) => {
                  console.error('Failed to fetch user profile on auth change:', err);
               });
            }
         } else if (event === 'SIGNED_OUT') {
            if (!session) {
               clearAuthCookieClient();
               dispatch(clearAuth());

               if (wasAuthenticatedRef.current && !AUTH_FLOW_PATHS.has(pathnameRef.current)) {
                  navigate('/request-board');
               }
            }
         }
      });

      // Initial session check
      supabase.auth.getSession().then(async ({ data: { session }, error: sessionError }) => {
         if (sessionError || !session) {
            clearAuthCookieClient();
            dispatch(clearAuth());
            dispatch(setAuthChecked());
            return;
         }

         try {
            const {
               data: { user: supabaseUser },
               error: userError
            } = await supabase.auth.getUser();

            if (userError || !supabaseUser) {
               const { error: refreshError } = await supabase.auth.refreshSession();
               if (refreshError) {
                  clearAuthCookieClient();
                  dispatch(clearAuth());
                  dispatch(setAuthChecked());
                  return;
               }
            }

            await dispatch(fetchUser()).unwrap();
         } catch (error) {
            console.error('Failed to fetch user profile during auth initialization:', error);
         } finally {
            dispatch(setAuthChecked());
         }
      });

      return () => {
         subscription.unsubscribe();
      };
   }, [dispatch, navigate]);

   return null;
}
