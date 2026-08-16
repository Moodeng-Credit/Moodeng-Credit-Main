import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';

import Loading from '@/components/Loading';
import {
   AuthErrorAlert,
   AuthFooter,
   AuthInputField,
   DividerWithText,
   SocialAuthButtons
} from '@/components/auth';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { fetchDefaultedBorrowerSupport } from '@/hooks/useDefaultedBorrowerSupport';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { clearPendingSharedRequestId, getPendingSharedRequestId } from '@/lib/pendingSharedRequest';
import { Icons } from '@/views/login/components/Icons';
import { loginUser, loginWithGoogle, loginWithTelegram } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import '@/views/signup/styles/signup.css';

const getPostSignInPath = async (user: { id: string; accountStatus?: string }) => {
   if (user.accountStatus === 'blocked' || user.accountStatus === 'banned') {
      return '/account-restricted';
   }

   const defaultedBorrower = await fetchDefaultedBorrowerSupport(user.id);
   if (defaultedBorrower.overdueAmount > 0) return '/account-restricted';

   // If they arrived via a shared request link before signing in, return them to that exact
   // request (opened on the board) instead of the generic dashboard.
   const sharedRequestId = getPendingSharedRequestId();
   if (sharedRequestId) {
      clearPendingSharedRequestId();
      return `/request-board?highlight=${encodeURIComponent(sharedRequestId)}`;
   }

   return '/dashboard';
};

export default function SignInPage() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const toast = useToast();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [showAccount, setShowAccount] = useState(false);
   const [errorType, setErrorType] = useState<
      'incorrect_credentials' | 'email_not_found' | 'new_user' | 'too_many_attempts' | 'provider_failed' | null
   >(null);
   // Which social provider failed, for the provider_failed alert copy.
   const [errorProvider, setErrorProvider] = useState<string | null>(null);
   const [attemptsRemaining, setAttemptsRemaining] = useState(5);
   const [rememberMe, setRememberMe] = useState(true);

   const getEmailHasProfile = async (value: string) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.rpc('email_exists', { p_email: value });

      if (error) return true;
      return !!data;
   };

   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setShowAccount(false);
      setErrorType(null);
      setErrorProvider(null);
      if (!email || !password) return;

      setIsLoading(true);
      try {
         const result = await dispatch(loginUser({ email, password, rememberMe })).unwrap();
         const nextPath = await getPostSignInPath(result.user);
         navigate(nextPath, { replace: true });
      } catch (err) {
         // .unwrap() throws a serialized plain object (SerializedError), not an
         // Error instance — read .message off it directly or every failure falls
         // into the generic branch below.
         const errObj = err as { status?: number; message?: string };
         const msg =
            typeof errObj?.message === 'string' && errObj.message.length > 0
               ? errObj.message
               : 'Authentication failed';
         const status = errObj?.status ?? 0;
         const lower = msg.toLowerCase();

         const isEmailError =
            lower.includes('verify') || lower.includes('email') || lower.includes('confirm');
         if (isEmailError) {
            toast.showToastByConfig('login_error', { error: msg });
            return;
         }

         const isRateLimited =
            status === 429 ||
            lower.includes('too many') ||
            lower.includes('rate limit') ||
            lower.includes('temporarily restricted') ||
            lower.includes('locked out') ||
            lower.includes('multiple failed') ||
            /\b0\s+attempts?\s+remaining\b/.test(lower);
         const isEmailNotFound =
            lower.includes('user not found') || lower.includes('email not found') || lower.includes('no user');
         if (isRateLimited) {
            setErrorType('too_many_attempts');
         } else if (isEmailNotFound) {
            setErrorType('email_not_found');
         } else if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
            const hasProfile = await getEmailHasProfile(email.trim().toLowerCase());
            setErrorType(hasProfile ? 'incorrect_credentials' : 'new_user');
         } else {
            const nextAttempts = Math.max(0, attemptsRemaining - 1);
            setAttemptsRemaining(nextAttempts);
            setErrorType(nextAttempts === 0 ? 'too_many_attempts' : 'incorrect_credentials');
         }
         setShowAccount(true);
      } finally {
         setIsLoading(false);
      }
   };

   const handleRetry = () => {
      setShowAccount(false);
      setErrorType(null);
      setErrorProvider(null);
      setPassword('');
   };

   const handleGoogleAuth = async (credential: string) => {
      setIsLoading(true);
      try {
         const result = await dispatch(loginWithGoogle({ googleCredential: credential })).unwrap();
         const nextPath = await getPostSignInPath(result.user);
         navigate(nextPath, { replace: true });
      } catch {
         // No password involved — don't blame "credentials" for a failed provider handshake.
         setErrorProvider('Google');
         setErrorType('provider_failed');
         setShowAccount(true);
      } finally {
         setIsLoading(false);
      }
   };

   const handleTelegramAuth = async (authData: Record<string, string>) => {
      setIsLoading(true);
      try {
         const result = await dispatch(
            loginWithTelegram({ telegramAuthData: JSON.stringify(authData) })
         ).unwrap();
         const nextPath = await getPostSignInPath(result.user);
         navigate(nextPath, { replace: true });
      } catch {
         // No password involved — don't blame "credentials" for a failed provider handshake.
         setErrorProvider('Telegram');
         setErrorType('provider_failed');
         setShowAccount(true);
      } finally {
         setIsLoading(false);
      }
   };

   if (isLoading) return <Loading />;

   return (
      <div className="flex justify-center items-center min-h-screen py-6 sm:py-12 px-4">
         <div
            className="flex flex-col w-full max-w-[440px] min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-6rem)] rounded-[20px] overflow-y-auto shrink-0"
            style={{
               // background: 'linear-gradient(180deg, #FBFAFD 0%, #FFFFFF 100%)',
               isolation: 'isolate'
            }}
         >
            <div className="flex flex-1 flex-col items-center justify-center w-full px-5 py-6 sm:py-10">
               {/* Mascot - 110x96 per design */}
               <img
                  src="/auth-screen.png"
                  alt="Moodeng Mascot"
                  className="w-[88px] h-[77px] object-contain mb-5"
               />
               <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] text-center mb-1">
                  Welcome back to Moodeng
               </h1>
               <p className="text-base font-medium leading-6 tracking-[-0.02em] text-[#6D6D6D] text-center mb-5">
                  Sign in to access your account.
               </p>

               {/* Social auth */}
               <div className="w-full flex flex-col gap-4">
                  <SocialAuthButtons
                     isSignUp={false}
                     onGoogleSuccess={handleGoogleAuth}
                     onGoogleError={() => setShowAccount(true)}
                     onTelegramAuth={handleTelegramAuth}
                  />

                  <DividerWithText text="OR" lineColor="#9285A0" textColor="#877897" />

                  {/* Email / Password form */}
                  <form onSubmit={handleLogin} className="flex flex-col gap-5">
                     <div className="flex flex-col gap-5">
                        <AuthInputField
                           label="Email Address"
                           type="email"
                           placeholder="Enter your email address"
                           value={email}
                           onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                           error={showAccount && errorType !== 'provider_failed'}
                           errorMessage={
                              showAccount && errorType === 'too_many_attempts'
                                 ? 'Too many attempts detected'
                                 : showAccount && errorType === 'new_user'
                                   ? 'New account needed'
                                 : showAccount && errorType === 'email_not_found'
                                   ? 'Email not found'
                                   : showAccount && errorType === 'incorrect_credentials'
                                     ? 'Incorrect credentials'
                                     : undefined
                           }
                           icon={<Icons.email />}
                        />
                        <div className="flex flex-col gap-2">
                           <AuthInputField
                              label="Password"
                              type="password"
                              placeholder="Enter your password"
                              value={password}
                              onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                              error={showAccount && errorType !== 'provider_failed'}
                              icon={<Icons.lock />}
                              showEyeToggle
                           />
                           <Link
                              to="/forgot-password"
                              className="self-end text-sm font-medium leading-5 tracking-[-0.02em] text-[#70617F] underline-offset-4 hover:text-[#6010D2] hover:underline"
                           >
                              Forgot password?
                           </Link>
                        </div>
                     </div>

                     {showAccount && errorType && (
                        <AuthErrorAlert
                           type={errorType}
                           provider={errorProvider ?? undefined}
                           onRetry={
                              errorType === 'incorrect_credentials' ||
                              errorType === 'email_not_found' ||
                              errorType === 'new_user' ||
                              errorType === 'provider_failed'
                                 ? handleRetry
                                 : undefined
                           }
                           signupHref={`/sign-up?email=${encodeURIComponent(email.trim())}`}
                           resetPasswordHref={`/forgot-password?email=${encodeURIComponent(email.trim())}`}
                        />
                     )}

                     <div className="flex flex-row items-center gap-2 w-full max-w-[400px] h-6">
                        <label className="flex flex-row items-center gap-2 cursor-pointer shrink-0">
                           <span className="relative flex size-6 shrink-0">
                              <input
                                 type="checkbox"
                                 checked={rememberMe}
                                 onChange={(e) => setRememberMe(e.target.checked)}
                                 className="peer absolute inset-0 z-10 cursor-pointer appearance-none rounded-lg"
                              />
                              <span className="pointer-events-none absolute inset-0 rounded-lg border border-[#B5ACBE] bg-white peer-checked:border-[#8336F0] peer-checked:bg-[#8336F0]" />
                              <svg
                                 className="pointer-events-none absolute inset-0 m-auto size-3.5 text-white opacity-0 peer-checked:opacity-100"
                                 fill="none"
                                 stroke="currentColor"
                                 strokeWidth="2.5"
                                 viewBox="0 0 24 24"
                              >
                                 <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                           </span>
                           <span className="text-base font-normal leading-6 text-[#4D4359] tracking-[-0.02em]">
                              Remember Me
                           </span>
                        </label>
                     </div>

                     <button
                        type="submit"
                        className="w-full h-14 rounded-2xl font-semibold text-[#FDFCFD] text-base tracking-[-0.02em] transition-opacity hover:opacity-95"
                        style={{ backgroundColor: '#6010D2' }}
                     >
                        Sign In to Moodeng
                     </button>

                     <p className="text-center text-sm text-[#70617F] tracking-[-0.02em]">
                        Don&apos;t have an account?{' '}
                        <Link
                           to="/sign-up"
                           className="font-semibold text-[#6010D2] underline-offset-4 hover:underline"
                        >
                           Sign Up
                        </Link>
                     </p>
                     <Link
                        to="/request-board?tour=1"
                        className="text-center text-sm font-medium tracking-[-0.02em] text-[#70617F] underline-offset-4 hover:text-[#6010D2] hover:underline"
                     >
                        Take a tour first
                     </Link>
                  </form>
               </div>
            </div>

            <AuthFooter />
         </div>
      </div>
   );
}
