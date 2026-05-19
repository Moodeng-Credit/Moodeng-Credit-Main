import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import Loading from '@/components/Loading';
import { markPasswordRecoveryReady } from '@/lib/passwordRecovery';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

const VERIFY_FALLBACK = '/auth-success?type=verify';
const CREATED_PATH = '/auth-success?type=created';
const RECOVERY_PATH = '/reset-password';

export function isPasswordRecoveryRedirect(url: URL, hashParams = new URLSearchParams()): boolean {
   const type = url.searchParams.get('type') ?? hashParams.get('type');
   const next = url.searchParams.get('next');

   return type === 'recovery' || next === RECOVERY_PATH;
}

export function getAuthConfirmDestination(isRecoveryRedirect: boolean, userRole?: string | null): string {
   if (isRecoveryRedirect) {
      return RECOVERY_PATH;
   }

   return userRole ? '/dashboard' : CREATED_PATH;
}

/**
 * Email confirmation and other auth redirects land here with ?code= (PKCE) or
 * #access_token=… in the URL. We must not client-navigate away before the session
 * is stored, or tokens are lost (previous route used instant <Navigate />).
 */
export default function AuthConfirmPage() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const [error, setError] = useState<string | null>(null);
   const finishedRef = useRef(false);

   useEffect(() => {
      if (!isSupabaseBrowserConfigured()) {
         navigate(VERIFY_FALLBACK, { replace: true });
         return;
      }

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let unsub: (() => void) | undefined;

      const finish = (path: string, isRecoveryRedirect = false) => {
         if (finishedRef.current) return;
         finishedRef.current = true;
         if (isRecoveryRedirect) {
            markPasswordRecoveryReady();
         }
         navigate(path, { replace: true });
      };

      const syncSessionFromUrl = async () => {
         const supabase = getSupabaseBrowserClient();
         const url = new URL(window.location.href);
         const code = url.searchParams.get('code');
         const tokenHash = url.searchParams.get('token_hash');
         const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
         const isRecoveryRedirect = isPasswordRecoveryRedirect(url, hashParams);

         if (code) {
            const { data: before } = await supabase.auth.getSession();
            if (!before.session) {
               const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
               if (exchangeError) {
                  const { data: retry } = await supabase.auth.getSession();
                  if (!retry.session) {
                     setError(exchangeError.message);
                     return false;
                  }
               }
            }
         }

         if (tokenHash && isRecoveryRedirect) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
               token_hash: tokenHash,
               type: 'recovery'
            });
            if (verifyError) {
               const { data: retry } = await supabase.auth.getSession();
               if (!retry.session) {
                  setError(verifyError.message);
                  return false;
               }
            }
         }

         const accessToken = hashParams.get('access_token');
         const refreshToken = hashParams.get('refresh_token');
         if (accessToken && refreshToken) {
            const { error: setErr } = await supabase.auth.setSession({
               access_token: accessToken,
               refresh_token: refreshToken
            });
            if (setErr) {
               setError(setErr.message);
               return false;
            }
         }

         await new Promise((r) => {
            queueMicrotask(r);
         });

         const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
         if (sessionError) {
            setError(sessionError.message);
            return false;
         }

         if (sessionData.session?.user) {
            const user = await dispatch(fetchUser()).unwrap().catch(() => null);
            finish(getAuthConfirmDestination(isRecoveryRedirect, user?.userRole), isRecoveryRedirect);
            return true;
         }

         const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session?.user || finishedRef.current) return;
            sub.subscription.unsubscribe();
            if (timeoutId) clearTimeout(timeoutId);
            void dispatch(fetchUser())
               .unwrap()
               .then((user) => finish(getAuthConfirmDestination(isRecoveryRedirect, user?.userRole), isRecoveryRedirect))
               .catch(() => finish(getAuthConfirmDestination(isRecoveryRedirect), isRecoveryRedirect));
         });
         unsub = () => sub.subscription.unsubscribe();

         timeoutId = setTimeout(() => {
            sub.subscription.unsubscribe();
            finish(VERIFY_FALLBACK);
         }, 12000);

         return true;
      };

      void syncSessionFromUrl();

      return () => {
         if (timeoutId) clearTimeout(timeoutId);
         unsub?.();
      };
   }, [dispatch, navigate]);

   if (error) {
      return (
         <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 bg-white">
            <p className="text-center text-sm text-red-600 max-w-md">{error}</p>
            <Link to="/sign-in" className="text-sm font-semibold text-[#8336F0] hover:underline">
               Back to login
            </Link>
         </div>
      );
   }

   return <Loading />;
}
