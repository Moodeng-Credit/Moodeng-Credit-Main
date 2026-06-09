import { useEffect, useRef, useState } from 'react';

import { HelpCircle } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';

import Loading from '@/components/Loading';
import { ThemeToggle } from '@/components/ThemeToggle';

import { markPasswordRecoveryReady } from '@/lib/passwordRecovery';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

const VERIFY_FALLBACK = '/auth-success?type=verify';
const CREATED_PATH = '/auth-success?type=created';
const RECOVERY_PATH = '/reset-password';

type AuthEmailOtpType = 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email_change' | 'email';

const AUTH_EMAIL_OTP_TYPES = new Set<AuthEmailOtpType>(['signup', 'magiclink', 'recovery', 'invite', 'email_change', 'email']);

export function isPasswordRecoveryRedirect(url: URL, hashParams = new URLSearchParams()): boolean {
   const type = url.searchParams.get('type') ?? hashParams.get('type');
   const next = url.searchParams.get('next');

   return type === 'recovery' || next === RECOVERY_PATH;
}

export function getAuthEmailOtpType(url: URL, hashParams = new URLSearchParams()): AuthEmailOtpType | null {
   const type = url.searchParams.get('type') ?? hashParams.get('type');
   return AUTH_EMAIL_OTP_TYPES.has(type as AuthEmailOtpType) ? (type as AuthEmailOtpType) : null;
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

      const finishFromCurrentSession = async (isRecoveryRedirect = false) => {
         const supabase = getSupabaseBrowserClient();
         const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
         if (sessionError) {
            setError('We could not finish checking your email session. Please sign in again.');
            return true;
         }

         if (!sessionData.session?.user) return false;

         const user = await dispatch(fetchUser())
            .unwrap()
            .catch(() => null);
         finish(getAuthConfirmDestination(isRecoveryRedirect, user?.userRole), isRecoveryRedirect);
         return true;
      };

      const syncSessionFromUrl = async () => {
         const supabase = getSupabaseBrowserClient();
         const url = new URL(window.location.href);
         const code = url.searchParams.get('code');
         const tokenHash = url.searchParams.get('token_hash');
         const hashParams = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
         const isRecoveryRedirect = isPasswordRecoveryRedirect(url, hashParams);
         const emailOtpType = getAuthEmailOtpType(url, hashParams);
         const linkError =
            url.searchParams.get('error_description') ||
            url.searchParams.get('error') ||
            hashParams.get('error_description') ||
            hashParams.get('error');

         if (linkError) {
            if (isRecoveryRedirect) {
               setError(linkError);
               return false;
            }

            if (await finishFromCurrentSession(false)) return true;
            setError(linkError);
            return false;
         }

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

         if (tokenHash && emailOtpType) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
               token_hash: tokenHash,
               type: emailOtpType
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

         if (sessionData.session?.user) return finishFromCurrentSession(isRecoveryRedirect);

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
         <div className="min-h-screen bg-[#FBFAFD] px-4 py-6 text-[#040033] dark:bg-[#0D0B14] dark:text-[#F0EAFF] sm:px-6 sm:py-10">
            <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[480px] flex-col">
               <div className="mb-5 flex justify-end gap-2">
                  <ThemeToggle />
                  <Link
                     to="/support/faq"
                     className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDFCFD] text-[#6010D2] shadow-[0_8px_24px_rgba(36,14,62,0.08)] transition hover:bg-[#F2EAFE] dark:bg-[#1E1530] dark:text-[#C084FC] dark:hover:bg-[#2A1D40]"
                     aria-label="Help"
                  >
                     <HelpCircle className="h-6 w-6" />
                  </Link>
               </div>

               <main className="flex flex-1 flex-col justify-center">
                  <section className="rounded-[28px] border border-[#E7D8FF] bg-[#FDFCFD] px-5 py-7 shadow-[0_18px_50px_rgba(36,14,62,0.08)] dark:border-[#2D1F4A] dark:bg-[#160F28] sm:px-7">
                     <div className="mb-7 flex flex-col items-center text-center">
                        <div className="mb-5 flex h-[196px] w-[196px] items-center justify-center overflow-hidden rounded-[28px] border border-[#DCC7FF] bg-white shadow-[0_12px_28px_rgba(36,14,62,0.06)] dark:border-[#2D1F4A] dark:bg-[#1E1530]">
                           <img
                              src="/hippos/hippo-friendly-lock.png"
                              alt="Moodeng holding a lock"
                              className="h-full w-full object-contain drop-shadow-[0_12px_22px_rgba(36,14,62,0.10)]"
                           />
                        </div>
                        <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#8336F0] dark:text-[#C084FC]">Account access</p>
                        <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#040033] dark:text-[#F0EAFF]">
                           This link did not work
                        </h1>
                        <p className="mt-3 max-w-[350px] text-base font-medium leading-6 tracking-[-0.02em] text-[#70617F] dark:text-[#A89BB8]">
                           Open the latest Moodeng email and try again, or sign in to request a new link.
                        </p>
                     </div>

                     <p className="mb-5 rounded-2xl border border-[#FFD2D8] bg-[#FFF0F2] px-4 py-3 text-sm font-semibold leading-5 text-[#B60413] dark:border-[#4A1A20] dark:bg-[#2A0F14] dark:text-[#FF8090]">
                        {error}
                     </p>

                     <Link
                        to="/sign-in"
                        className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95"
                     >
                        Back to sign in
                     </Link>
                  </section>
               </main>
            </div>
         </div>
      );
   }

   return <Loading />;
}
