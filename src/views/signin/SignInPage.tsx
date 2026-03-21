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
import { Icons } from '@/views/login/components/Icons';
import { loginUser, loginWithGoogle, loginWithTelegram } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import '@/views/signup/styles/signup.css';

export default function SignInPage() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const toast = useToast();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [showAccount, setShowAccount] = useState(false);
   const [errorType, setErrorType] = useState<
      'incorrect_credentials' | 'email_not_found' | 'too_many_attempts' | null
   >(null);
   const [attemptsRemaining, setAttemptsRemaining] = useState(5);

   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setShowAccount(false);
      setErrorType(null);
      if (!email || !password) return;

      setIsLoading(true);
      try {
         const result = await dispatch(loginUser({ email, password })).unwrap();
         navigate(result.user?.userRole ? '/dashboard' : '/select-role');
      } catch (err) {
         const msg = err instanceof Error ? err.message : 'Authentication failed';
         const errObj = err as { status?: number };
         const status = errObj?.status ?? 0;
         const lower = msg.toLowerCase();

         const isEmailError =
            lower.includes('verify') || lower.includes('email') || lower.includes('confirm');
         if (isEmailError) {
            toast.showToastByConfig('login_error', { error: msg });
            return;
         }

         const isRateLimited =
            status === 429 || lower.includes('too many') || lower.includes('rate limit');
         const isEmailNotFound =
            lower.includes('user not found') || lower.includes('email not found') || lower.includes('no user');
         if (isRateLimited) {
            setErrorType('too_many_attempts');
         } else if (isEmailNotFound) {
            setErrorType('email_not_found');
         } else {
            setErrorType('incorrect_credentials');
            setAttemptsRemaining((prev) => Math.max(0, prev - 1));
         }
         setShowAccount(true);
      } finally {
         setIsLoading(false);
      }
   };

   const handleRetry = () => {
      setShowAccount(false);
      setErrorType(null);
      setPassword('');
   };

   const handleGoogleAuth = async (credential: string) => {
      setIsLoading(true);
      try {
         const result = await dispatch(loginWithGoogle({ googleCredential: credential })).unwrap();
         navigate(result.user?.userRole ? '/dashboard' : '/select-role');
      } catch {
         setErrorType('incorrect_credentials');
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
         navigate(result.user?.userRole ? '/dashboard' : '/select-role');
      } catch {
         setErrorType('incorrect_credentials');
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
                           error={showAccount}
                           errorMessage={
                              showAccount && errorType === 'too_many_attempts'
                                 ? 'Too many attempts detected'
                                 : showAccount && errorType === 'email_not_found'
                                   ? 'Email not found'
                                   : showAccount && errorType === 'incorrect_credentials'
                                     ? 'Incorrect credentials'
                                     : undefined
                           }
                           icon={<Icons.email />}
                        />
                        <AuthInputField
                           label="Password"
                           type="password"
                           placeholder="Enter your password"
                           value={password}
                           onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                           error={showAccount}
                           icon={<Icons.lock />}
                           showEyeToggle
                        />
                     </div>

                     {showAccount && errorType && (
                        <AuthErrorAlert
                           type={errorType}
                           attemptsRemaining={attemptsRemaining}
                           onRetry={
                              errorType === 'incorrect_credentials' || errorType === 'email_not_found'
                                 ? handleRetry
                                 : undefined
                           }
                        />
                     )}

                     <div className="flex flex-row justify-between items-center gap-2 w-full max-w-[400px] h-6">
                        <label className="flex flex-row items-center gap-2 cursor-pointer shrink-0">
                           <span className="relative flex size-6 shrink-0">
                              <input
                                 type="checkbox"
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
                        <Link
                           to="/forgot-password"
                           className="text-base font-semibold leading-6 text-[#8336F0] tracking-[-0.02em] hover:underline shrink-0"
                        >
                           Forgot Password
                        </Link>
                     </div>

                     <button
                        type="submit"
                        className="w-full h-14 rounded-2xl font-semibold text-[#FDFCFD] text-base tracking-[-0.02em] transition-opacity hover:opacity-95"
                        style={{ backgroundColor: '#6010D2' }}
                     >
                        Sign In to Moodeng
                     </button>

                     <p className="text-center text-base text-[#4D4359] tracking-[-0.02em]">
                        Don&apos;t have an account?{' '}
                        <Link
                           to="/signup"
                           className="font-semibold hover:underline"
                           style={{ color: '#8336F0' }}
                        >
                           Sign Up
                        </Link>
                     </p>
                  </form>
               </div>
            </div>

            <AuthFooter />
         </div>
      </div>
   );
}
