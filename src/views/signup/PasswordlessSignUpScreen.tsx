import { useEffect, useMemo, useState } from 'react';

import posthog from 'posthog-js';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
   AuthFooter,
   DividerWithText,
   FacebookAuthButton,
   PasswordlessAuthForm,
   SocialAuthButtons,
   useFacebookPrimary
} from '@/components/auth';
import Loading from '@/components/Loading';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { detectInAppBrowser, isFacebookInApp } from '@/lib/inAppBrowser';
import { registerWithGoogle, registerWithTelegram } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import '@/views/signup/styles/signup.css';

const LINK_PURPLE = '#8336F0';

// dispatch(...).unwrap() throws Redux Toolkit's SerializedError, a plain object
// (not an Error instance) that still carries the original `message` string. An
// `instanceof Error` check misses it entirely, so every rejected thunk fell back
// to the generic 'Authentication failed' regardless of the real failure reason.
function getErrorMessage(err: unknown, fallback: string): string {
   if (err instanceof Error) return err.message;
   if (typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string') {
      const message = (err as { message: string }).message;
      if (message) return message;
   }
   return fallback;
}

/**
 * Slack/Notion-style sign-up: Phone (🇵🇭 +63) or Email, then a code. No password (they can add
 * one later). Shown inside Facebook/Messenger's browser, where Google sign-in can't work; see
 * showPasswordlessSignup in lib/phoneAuth for the switch to show it everywhere.
 */
export default function PasswordlessSignUpScreen() {
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const dispatch = useDispatch<AppDispatch>();
   const toast = useToast();
   const initialEmail = searchParams.get('email')?.trim() ?? '';
   // Inside Facebook's (or any app's) browser Google sign-in can't work, so the code form leads there.
   const inApp = useMemo(() => detectInAppBrowser(), []);
   const inAppBrowser = inApp.isInApp;
   // Facebook/Messenger: a phone/email code is the way in (Google is only a small "open in Chrome" line).
   const facebookInApp = isFacebookInApp(inApp);
   // Inside Facebook/Messenger/Instagram (once Facebook login is on) "Continue with Facebook" leads, above the code form.
   const facebookPrimary = useFacebookPrimary();
   const [isLoading, setIsLoading] = useState(false);

   useEffect(() => {
      if (import.meta.env.PROD && facebookInApp) posthog.capture('signup_inapp_email_shown', { app: inApp.appName, os: inApp.os });
   }, [facebookInApp, inApp]);

   const processAuthResult = (result: unknown) => {
      const data = result as { user?: { id?: string; userRole?: string | null } };
      navigate(data?.user?.userRole ? '/dashboard' : '/auth-success?type=created', { replace: true });
   };

   const handleProviderError = (errorMsg: string) => {
      const lower = (errorMsg || '').toLowerCase();
      // "Failed to fetch" / "Load failed" are raw browser fetch errors — meaningless
      // to a user. Show something actionable instead of echoing them verbatim.
      const isNetworkError = lower.includes('failed to fetch') || lower.includes('load failed') || lower.includes('network');
      toast.showToastByConfig('register_error', {
         error: isNetworkError ? 'Could not reach the server. Check your connection and try again.' : errorMsg
      });
   };

   const handleGoogleAuth = async (credential: string) => {
      setIsLoading(true);
      try {
         const result = await dispatch(registerWithGoogle({ googleCredential: credential })).unwrap();
         processAuthResult(result);
      } catch (err) {
         handleProviderError(getErrorMessage(err, 'Authentication failed'));
      } finally {
         setIsLoading(false);
      }
   };

   const handleTelegramAuth = async (authData: Record<string, string>) => {
      setIsLoading(true);
      try {
         const result = await dispatch(registerWithTelegram({ telegramAuthData: JSON.stringify(authData) })).unwrap();
         processAuthResult(result);
      } catch (err) {
         handleProviderError(getErrorMessage(err, 'Authentication failed'));
      } finally {
         setIsLoading(false);
      }
   };

   const handleOAuthError = () => {
      handleProviderError('Google sign-in did not finish. Try again, or get a code by phone or email.');
   };

   if (isLoading) {
      return <Loading />;
   }

   const codeForm = <PasswordlessAuthForm mode="signup" inApp={inApp} initialEmail={initialEmail} />;
   const orDivider = <DividerWithText text="OR" lineColor="#9285A0" textColor="#877897" className="my-6" />;

   return (
      <div className="flex justify-center items-center min-h-screen py-6 sm:py-12 px-4">
         <div
            className="flex flex-col w-full max-w-[440px] min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-6rem)] items-center rounded-[20px] overflow-y-auto shrink-0"
            style={{ isolation: 'isolate' }}
         >
            <div className="flex flex-1 flex-col items-center justify-center w-full px-5 py-6 sm:py-10">
               <img
                  src="/auth-screen.png"
                  alt="Moodeng Mascot"
                  className="w-[110px] h-[96px] sm:w-[140px] sm:h-[120px] object-contain mb-5"
               />

               <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] text-center mb-1">
                  Sign up to Moodeng
               </h1>
               <p className="text-base font-medium leading-6 tracking-[-0.02em] text-[#6D6D6D] text-center mb-5 max-w-[400px]">
                  No password needed.
               </p>

               {inAppBrowser ? (
                  <>
                     {facebookPrimary ? (
                        <>
                           <FacebookAuthButton isSignUp variant="full" />
                           {orDivider}
                        </>
                     ) : null}
                     {codeForm}
                     {/* Google and Telegram can't sign in inside Facebook/Messenger: left out there. */}
                     {facebookInApp ? null : (
                        <>
                           {orDivider}
                           <SocialAuthButtons
                              isSignUp
                              hideFacebook
                              onGoogleSuccess={handleGoogleAuth}
                              onGoogleError={handleOAuthError}
                              onTelegramAuth={handleTelegramAuth}
                           />
                        </>
                     )}
                     <div className="mb-4" />
                  </>
               ) : (
                  <>
                     <SocialAuthButtons
                        isSignUp
                        onGoogleSuccess={handleGoogleAuth}
                        onGoogleError={handleOAuthError}
                        onTelegramAuth={handleTelegramAuth}
                     />
                     {orDivider}
                     {codeForm}
                     <div className="mb-4" />
                  </>
               )}
               <p className="mt-2 text-center text-base text-[#4D4359] tracking-[-0.02em]">
                  Already have an account?{' '}
                  <Link to="/sign-in" className="font-semibold hover:underline" style={{ color: LINK_PURPLE }}>
                     Log In
                  </Link>
               </p>
               {facebookInApp ? null : (
                  <Link
                     to="/request-board?tour=1"
                     className="mt-4 text-center text-base font-semibold tracking-[-0.02em] text-[#8336F0] hover:underline"
                  >
                     Take a tour first
                  </Link>
               )}
            </div>

            <AuthFooter short={facebookInApp} />
         </div>
      </div>
   );
}
