import { type FormEvent, type JSX, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, HelpCircle, ShieldCheck } from 'lucide-react';

import Loading from '@/components/Loading';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

type RecoveryState = 'checking' | 'ready' | 'invalid';

export default function ResetPasswordPage(): JSX.Element {
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [message, setMessage] = useState('');
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);
   const [recoveryState, setRecoveryState] = useState<RecoveryState>('checking');
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const hasExchanged = useRef(false);

   useEffect(() => {
      const prepareRecoverySession = async () => {
         if (hasExchanged.current) return;
         hasExchanged.current = true;

         if (!isSupabaseBrowserConfigured()) {
            setError('Password reset is not configured in this local app.');
            setRecoveryState('invalid');
            return;
         }

         const code = searchParams.get('code');
         const tokenHash = searchParams.get('token_hash');
         const hashParams = new URLSearchParams(window.location.hash.substring(1));
         const accessToken = hashParams.get('access_token');
         const refreshToken = hashParams.get('refresh_token');

         const supabase = getSupabaseBrowserClient();

         try {
            if (code) {
               const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
               if (exchangeError || !data.session) {
                  setError('The reset link is invalid or expired. Request a new one and use the latest email from Moodeng.');
                  setRecoveryState('invalid');
                  return;
               }
               setRecoveryState('ready');
               return;
            }

            if (accessToken && refreshToken) {
               const { error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
               });
               if (sessionError) {
                  setError('The reset link is invalid or expired. Request a new one and use the latest email from Moodeng.');
                  setRecoveryState('invalid');
                  return;
               }
               setRecoveryState('ready');
               return;
            }

            if (tokenHash) {
               const { error: verifyError } = await supabase.auth.verifyOtp({
                  token_hash: tokenHash,
                  type: 'recovery'
               });
               if (verifyError) {
                  setError('The reset link is invalid or expired. Request a new one and use the latest email from Moodeng.');
                  setRecoveryState('invalid');
                  return;
               }
               setRecoveryState('ready');
               return;
            }

            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData.session) {
               setRecoveryState('ready');
               return;
            }

            setError('Open the reset link from your email, or request a new password reset link.');
            setRecoveryState('invalid');
         } catch (recoveryError) {
            setError(recoveryError instanceof Error ? recoveryError.message : 'Could not open this reset link. Request a new one.');
            setRecoveryState('invalid');
         }
      };

      prepareRecoverySession();
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

         setMessage('Password updated. You can sign in with the new password now.');
         setPassword('');
         setConfirmPassword('');
         window.setTimeout(() => {
            navigate('/sign-in');
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

                  <form onSubmit={handleSubmit} className="space-y-5">
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
                     ) : recoveryState === 'invalid' ? (
                        <p className="rounded-2xl border border-[#E7D8FF] bg-[#F8F4FC] px-4 py-3 text-sm font-semibold leading-5 text-[#4D4359]">
                           Request a fresh link if this screen was opened without the latest reset email.
                        </p>
                     ) : (
                        <p className="flex items-start gap-3 rounded-2xl border border-[#E7D8FF] bg-[#F8F4FC] px-4 py-3 text-sm font-semibold leading-5 text-[#4D4359]">
                           <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#8336F0]" />
                           This link is ready. Set your new password below.
                        </p>
                     )}

                     <button
                        type="submit"
                        disabled={loading || recoveryState !== 'ready' || !password || !confirmPassword}
                        className="h-14 w-full rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95 disabled:bg-[#BDB5C7] disabled:text-[#FDFCFD]"
                     >
                        {loading ? 'Updating...' : 'Update password'}
                     </button>
                  </form>

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
