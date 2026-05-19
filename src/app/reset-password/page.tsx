import { type FormEvent, type JSX, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, HelpCircle, ShieldCheck } from 'lucide-react';

import Loading from '@/components/Loading';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import {
   clearPasswordRecoveryReady,
   isPasswordRecoveryReady,
   markPasswordRecoveryReady
} from '@/lib/passwordRecovery';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

type RecoveryState = 'checking' | 'ready' | 'invalid';

const RESET_LINK_ERROR = 'The reset link is invalid or expired. Request a new one and use the latest email from Moodeng.';
const MISSING_RESET_SESSION_ERROR = 'Open the reset link from your email, or request a new password reset link.';
const RECOVERY_SESSION_SETTLE_MS = 1200;

export default function ResetPasswordPage(): JSX.Element {
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [message, setMessage] = useState('');
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);
   const [recoveryState, setRecoveryState] = useState<RecoveryState>('checking');
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const toast = useToast();

   useEffect(() => {
      let cancelled = false;
      let settleTimer: ReturnType<typeof window.setTimeout> | undefined;

      const markReady = () => {
         if (cancelled) return;
         markPasswordRecoveryReady();
         setError('');
         setRecoveryState('ready');
      };

      const markInvalid = (message: string) => {
         if (cancelled) return;
         setError(message);
         setRecoveryState('invalid');
      };

      if (!isSupabaseBrowserConfigured()) {
         markInvalid('Password reset is not configured in this local app.');
         return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
         data: { subscription }
      } = supabase.auth.onAuthStateChange((event, session) => {
         if (session?.user && (event === 'PASSWORD_RECOVERY' || isPasswordRecoveryReady())) {
            if (settleTimer) window.clearTimeout(settleTimer);
            markReady();
         }
      });

      const prepareRecoverySession = async () => {
         const code = searchParams.get('code');
         const tokenHash = searchParams.get('token_hash');
         const hashParams = new URLSearchParams(window.location.hash.substring(1));
         const accessToken = hashParams.get('access_token');
         const refreshToken = hashParams.get('refresh_token');
         const linkError = searchParams.get('error_description') ?? hashParams.get('error_description');

         try {
            if (linkError) {
               markInvalid(linkError);
               return;
            }

            if (code) {
               const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
               if (exchangeError || !data.session) {
                  const { data: retry } = await supabase.auth.getSession();
                  if (retry.session?.user) {
                     markReady();
                     return;
                  }
                  markInvalid(RESET_LINK_ERROR);
                  return;
               }
               markReady();
               return;
            }

            if (accessToken && refreshToken) {
               const { error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
               });
               if (sessionError) {
                  markInvalid(RESET_LINK_ERROR);
                  return;
               }
               markReady();
               return;
            }

            if (tokenHash) {
               const { error: verifyError } = await supabase.auth.verifyOtp({
                  token_hash: tokenHash,
                  type: 'recovery'
               });
               if (verifyError) {
                  const { data: retry } = await supabase.auth.getSession();
                  if (retry.session?.user) {
                     markReady();
                     return;
                  }
                  markInvalid(RESET_LINK_ERROR);
                  return;
               }
               markReady();
               return;
            }

            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session?.user && isPasswordRecoveryReady()) {
               markReady();
               return;
            }

            settleTimer = window.setTimeout(async () => {
               const { data: settledSession } = await supabase.auth.getSession();
               if (settledSession.session?.user && isPasswordRecoveryReady()) {
                  markReady();
                  return;
               }
               markInvalid(MISSING_RESET_SESSION_ERROR);
            }, RECOVERY_SESSION_SETTLE_MS);
         } catch (recoveryError) {
            markInvalid(recoveryError instanceof Error ? recoveryError.message : 'Could not open this reset link. Request a new one.');
         }
      };

      void prepareRecoverySession();

      return () => {
         cancelled = true;
         if (settleTimer) window.clearTimeout(settleTimer);
         subscription.unsubscribe();
      };
   }, [searchParams]);

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage('');
      setError('');

      if (password !== confirmPassword) {
         setError('Passwords do not match.');
         return;
      }

      if (password.length < 6) {
         setError('Use at least 6 characters for your new password.');
         return;
      }

      if (recoveryState !== 'ready') {
         setError('Open the reset link from your email before setting a new password.');
         return;
      }

      setLoading(true);

      try {
         const supabase = getSupabaseBrowserClient();
         const { error: updateError } = await supabase.auth.updateUser({ password });

         if (updateError) {
            setError(updateError.message || 'Could not update your password. Try again in a moment.');
            return;
         }

         clearPasswordRecoveryReady();
         toast.showToast(TOAST_TYPES.SUCCESS, 'Password updated', 'Your account is secure now.');
         setMessage('Password updated. Taking you to your dashboard now.');
         setPassword('');
         setConfirmPassword('');
         window.setTimeout(() => {
            navigate('/dashboard');
         }, 1800);
      } catch (resetError) {
         setError(resetError instanceof Error ? resetError.message : 'Could not update your password. Try again in a moment.');
      } finally {
         setLoading(false);
      }
   };

   if (recoveryState === 'checking') {
      return <Loading />;
   }

   const canSubmit =
      !loading &&
      recoveryState === 'ready' &&
      password.length >= 6 &&
      confirmPassword.length >= 6 &&
      password === confirmPassword;
   const showPasswordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

   return (
      <div className="min-h-screen bg-[#FBFAFD] px-4 py-6 text-[#040033] sm:px-6 sm:py-10">
         <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[480px] flex-col">
            <div className="mb-5 flex items-center justify-between">
               <Link
                  to="/sign-in"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDFCFD] text-[#6010D2] shadow-[0_8px_24px_rgba(36,14,62,0.08)] transition hover:bg-[#F2EAFE]"
                  aria-label="Back to sign in"
               >
                  <ArrowLeft className="h-6 w-6" />
               </Link>
               <Link
                  to="/support/faq"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDFCFD] text-[#6010D2] shadow-[0_8px_24px_rgba(36,14,62,0.08)] transition hover:bg-[#F2EAFE]"
                  aria-label="Help"
               >
                  <HelpCircle className="h-6 w-6" />
               </Link>
            </div>

            <main className="flex flex-1 flex-col justify-center">
               <section className="rounded-[28px] border border-[#E7D8FF] bg-[#FDFCFD] px-5 py-7 shadow-[0_18px_50px_rgba(36,14,62,0.08)] sm:px-7">
                  <div className="mb-7 flex flex-col items-center text-center">
                     <img
                        src="/hippos/hippo-friendly-lock.png"
                        alt="Moodeng holding a lock"
                        className="mb-5 h-28 w-28 object-contain drop-shadow-[0_12px_22px_rgba(36,14,62,0.10)]"
                     />
                     <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#8336F0]">
                        New password
                     </p>
                     <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#040033]">
                        Secure your account
                     </h1>
                     <p className="mt-3 max-w-[340px] text-base font-medium leading-6 tracking-[-0.02em] text-[#70617F]">
                        Choose a new password for your Moodeng account.
                     </p>
                  </div>

                  {recoveryState === 'invalid' ? (
                     <div className="space-y-5">
                        <p className="rounded-2xl border border-[#FFD2D8] bg-[#FFF0F2] px-4 py-3 text-sm font-semibold leading-5 text-[#B60413]">
                           {error || MISSING_RESET_SESSION_ERROR}
                        </p>
                        <p className="rounded-2xl border border-[#E7D8FF] bg-[#F8F4FC] px-4 py-3 text-sm font-semibold leading-5 text-[#4D4359]">
                           Use the newest Moodeng reset email. Older reset links can expire or be replaced by newer emails.
                        </p>
                     </div>
                  ) : (
                     <form onSubmit={handleSubmit} className="space-y-5">
                        <p className="flex items-start gap-3 rounded-2xl border border-[#E7D8FF] bg-[#F8F4FC] px-4 py-3 text-sm font-semibold leading-5 text-[#4D4359]">
                           <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8336F0]" />
                           This reset link is ready. Enter matching passwords to continue.
                        </p>

                        <div className="space-y-2">
                           <label htmlFor="password" className="text-base font-semibold tracking-[-0.02em] text-[#040033]">
                              New password
                           </label>
                           <input
                              id="password"
                              name="password"
                              type="password"
                              required
                              value={password}
                              onChange={(event) => {
                                 setPassword(event.target.value);
                                 setError('');
                              }}
                              className="h-14 w-full rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-4 text-base text-[#040033] shadow-[0_2px_4px_rgba(27,28,29,0.04)] outline-none placeholder:text-[#70617F] focus:border-[#8336F0] focus:ring-4 focus:ring-[#E9D8FF]"
                              placeholder="Enter new password"
                              autoComplete="new-password"
                           />
                           <p className="text-sm font-medium leading-5 text-[#70617F]">Use at least 6 characters.</p>
                        </div>

                        <div className="space-y-2">
                           <label htmlFor="confirmPassword" className="text-base font-semibold tracking-[-0.02em] text-[#040033]">
                              Confirm password
                           </label>
                           <input
                              id="confirmPassword"
                              name="confirmPassword"
                              type="password"
                              required
                              value={confirmPassword}
                              onChange={(event) => {
                                 setConfirmPassword(event.target.value);
                                 setError('');
                              }}
                              className="h-14 w-full rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-4 text-base text-[#040033] shadow-[0_2px_4px_rgba(27,28,29,0.04)] outline-none placeholder:text-[#70617F] focus:border-[#8336F0] focus:ring-4 focus:ring-[#E9D8FF]"
                              placeholder="Re-enter new password"
                              autoComplete="new-password"
                           />
                           {showPasswordMismatch ? (
                              <p className="text-sm font-semibold leading-5 text-[#B60413]">Passwords do not match.</p>
                           ) : null}
                        </div>

                        {error ? (
                           <p className="rounded-2xl border border-[#FFD2D8] bg-[#FFF0F2] px-4 py-3 text-sm font-semibold leading-5 text-[#B60413]">
                              {error}
                           </p>
                        ) : null}
                        {message ? (
                           <p className="flex items-start gap-3 rounded-2xl border border-[#BCEFD0] bg-[#EDFFF4] px-4 py-3 text-sm font-semibold leading-5 text-[#0D7A3C]">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                              {message}
                           </p>
                        ) : null}

                        <button
                           type="submit"
                           disabled={!canSubmit}
                           className="h-14 w-full rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95 disabled:bg-[#BDB5C7] disabled:text-[#FDFCFD]"
                        >
                           {loading ? 'Updating...' : 'Update password'}
                        </button>
                     </form>
                  )}

                  <Link
                     to={recoveryState === 'invalid' ? '/forgot-password' : '/sign-in'}
                     className="mt-5 flex h-12 items-center justify-center rounded-2xl border border-[#E0D7E8] text-sm font-semibold text-[#4D4359] transition hover:bg-[#F8F4FC]"
                  >
                     {recoveryState === 'invalid' ? 'Request a new link' : 'Back to sign in'}
                  </Link>
               </section>
            </main>
         </div>
      </div>
   );
}
