import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';

import { ArrowLeft } from 'lucide-react';
import posthog from 'posthog-js';
import { useDispatch } from 'react-redux';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import {
   AuthErrorAlert,
   AuthFooter,
   AuthInputField,
   DividerWithText,
   FacebookAuthButton,
   PasswordlessAuthForm,
   SocialAuthButtons,
   useFacebookPrimary
} from '@/components/auth';
import Loading from '@/components/Loading';
import { MessengerGlyph, messengerSupportLinkProps } from '@/components/support/MessengerChatButton';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { useSignedInRedirect } from '@/hooks/useSignedInRedirect';

import { rememberNextPath } from '@/lib/authNext';
import { facebookLeadsCodeLayout } from '@/lib/facebookAuth';
import { detectInAppBrowser, isFacebookInApp } from '@/lib/inAppBrowser';
import { isLikelyPhilippines } from '@/lib/isLikelyPhilippines';
import { getLastUsedAuth } from '@/lib/lastUsedAuth';
import { BANNED_MESSAGE } from '@/lib/otpErrors';
import { isSmsLoginEnabled, showPasswordlessSignup, showPhoneFirst } from '@/lib/phoneAuth';
import { getPostSignInPath } from '@/lib/postSignInPath';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { loginUser, loginWithGoogle, loginWithTelegram, type OtpChannel } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import IdEntryBanner from '@/views/indonesia/IdEntryBanner';
import { clearIdTrackIntent } from '@/views/indonesia/idFlow';
import { Icons } from '@/views/login/components/Icons';
import '@/views/signup/styles/signup.css';

// Supabase Auth refuses banned accounts with "User is banned" (code user_banned); the Google and
// Telegram edge functions pass that through. Show it plainly instead of a credentials error.
const isBannedError = (err: unknown) => {
   const e = err as { code?: string; message?: string } | null;
   return e?.code === 'user_banned' || /\bbanned\b/i.test(e?.message ?? '');
};

// Someone typing a Philippine mobile number into the email box: 09…, +63… or 63…
const startsLikePhMobile = (value: string) => /^(\+63|63|09)/.test(value.replace(/[\s\-().]/g, ''));

export default function SignInPage() {
   const navigate = useNavigate();
   const location = useLocation();
   const [searchParams] = useSearchParams();
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
   // Always remembered: the "Remember Me" box went in the 2026-11-25 clean-up (nobody unticks it on their own phone).
   const rememberMe = true;
   const [identifierError, setIdentifierError] = useState<string | null>(null);
   // Facebook/Messenger's browser: Google can't sign in there, so the email form comes first.
   const inApp = useMemo(() => detectInAppBrowser(), []);
   const facebookInApp = isFacebookInApp(inApp);
   // Facebook first: "Continue with Facebook" tops the page, also in Messenger and above the +63 box.
   const facebookPrimary = useFacebookPrimary();
   // Where sign-up is passwordless (any in-app browser), sign-in opens on the code form too.
   // Everywhere else the password form stays first, with "Email me a code" / "Text me a code".
   // In the Philippines the +63 number box comes first (GCash-style), with Google/Telegram under it.
   const phoneFirst = useMemo(() => showPhoneFirst(inApp.isInApp), [inApp.isInApp]);
   // Facebook is the bold blue button and the code form's button is outlined — unless this phone last logged
   // in with a phone/email code (then their usual way stays bold).
   const facebookLeads = useMemo(
      () => (inApp.isInApp || phoneFirst) && facebookLeadsCodeLayout(facebookPrimary, getLastUsedAuth()),
      [inApp.isInApp, phoneFirst, facebookPrimary]
   );
   // Normal browsers outside the Philippines (George, 2026-11-25): Facebook, the small tiles and "Use email
   // instead". Email opens a code form (password one tap away), or opens straight away for people who used
   // email or a phone code last time, or came back from the code screen (?method=).
   const emailCollapsible = facebookPrimary && !inApp.isInApp && !phoneFirst;
   const [emailOpen, setEmailOpen] = useState(() => {
      const method = searchParams.get('method');
      const lastUsed = getLastUsedAuth();
      return method === 'email' || method === 'phone' || lastUsed === 'email' || lastUsed === 'phone';
   });
   const [usePassword, setUsePassword] = useState(() => !emailCollapsible && !phoneFirst && !showPasswordlessSignup(inApp.isInApp));
   const [codeChannel, setCodeChannel] = useState<OtpChannel | undefined>(phoneFirst ? 'sms' : undefined);
   const [codePhone, setCodePhone] = useState('');
   const smsEnabled = useMemo(() => isSmsLoginEnabled(), []);
   // Visitors in the Philippines get one "Email or mobile number" box, like Google's sign-in: a
   // number moves them to the text-code form, an email brings up the password. Everyone else keeps
   // email + password (typing 09…/+63… still switches to phone, for Filipinos abroad).
   const emailOrPhone = useMemo(() => smsEnabled && isLikelyPhilippines(), [smsEnabled]);
   const showPasswordFields = !emailOrPhone || email.includes('@') || password.length > 0;
   // Already signed in (often a guest whose Facebook page reloaded): straight to their next step.
   const redirectingSignedIn = useSignedInRedirect();
   const switchToCode = (channel: OtpChannel, phone = '') => {
      handleRetry();
      setCodePhone(phone);
      setCodeChannel(channel);
      setUsePassword(false);
   };

   const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      if (smsEnabled && startsLikePhMobile(next)) {
         setEmail('');
         switchToCode('sms', next);
         return;
      }
      setEmail(next);
   };

   // Came here from a protected page (or ?next=): go back there after signing in, whichever way
   // they sign in (password, Google, Telegram, a code, the email link). See lib/authNext.
   useEffect(() => {
      const from = (location.state as { from?: { pathname?: string; search?: string } } | null)?.from;
      if (from?.pathname) rememberNextPath(`${from.pathname}${from.search ?? ''}`);
      else if (searchParams.get('next')) rememberNextPath(searchParams.get('next'));
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // A /id Telegram tap that never finished must not turn this sign-in into an Indonesia sign-up.
   useEffect(() => {
      clearIdTrackIntent();
   }, []);

   useEffect(() => {
      if (import.meta.env.PROD && facebookInApp) posthog.capture('signin_inapp_email_shown', { app: inApp.appName, os: inApp.os });
   }, [facebookInApp, inApp]);

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
      setIdentifierError(null);
      if (emailOrPhone && !email.includes('@')) {
         setIdentifierError(email.trim() ? 'Type your full email' : 'Enter your email or number');
         return;
      }
      if (!email || !password) return;
      if (import.meta.env.PROD && facebookInApp) posthog.capture('signin_inapp_email_submitted', { app: inApp.appName, os: inApp.os });

      setIsLoading(true);
      try {
         const result = await dispatch(loginUser({ email, password, rememberMe })).unwrap();
         const nextPath = await getPostSignInPath(result.user);
         navigate(nextPath, { replace: true });
      } catch (err) {
         // .unwrap() throws a serialized plain object (SerializedError), not an
         // Error instance — read .message off it directly or every failure falls
         // into the generic branch below.
         if (isBannedError(err)) {
            toast.showToastByConfig('login_error', { error: BANNED_MESSAGE });
            return;
         }
         const errObj = err as { status?: number; message?: string };
         const msg = typeof errObj?.message === 'string' && errObj.message.length > 0 ? errObj.message : 'Authentication failed';
         const status = errObj?.status ?? 0;
         const lower = msg.toLowerCase();

         const isEmailError = lower.includes('verify') || lower.includes('email') || lower.includes('confirm');
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
         const isEmailNotFound = lower.includes('user not found') || lower.includes('email not found') || lower.includes('no user');
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
      } catch (err) {
         if (isBannedError(err)) {
            toast.showToastByConfig('login_error', { error: BANNED_MESSAGE });
            return;
         }
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
         const result = await dispatch(loginWithTelegram({ telegramAuthData: JSON.stringify(authData) })).unwrap();
         const nextPath = await getPostSignInPath(result.user);
         navigate(nextPath, { replace: true });
      } catch (err) {
         if (isBannedError(err)) {
            toast.showToastByConfig('login_error', { error: BANNED_MESSAGE });
            return;
         }
         // No password involved — don't blame "credentials" for a failed provider handshake.
         setErrorProvider('Telegram');
         setErrorType('provider_failed');
         setShowAccount(true);
      } finally {
         setIsLoading(false);
      }
   };

   if (isLoading || redirectingSignedIn) return <Loading />;

   const showFacebookOnTop = facebookPrimary && (inApp.isInApp || phoneFirst || emailCollapsible);
   const socialAuth = (
      <SocialAuthButtons
         isSignUp={false}
         hideFacebook={showFacebookOnTop}
         philippines={phoneFirst}
         centered={phoneFirst || emailCollapsible}
         onGoogleSuccess={handleGoogleAuth}
         onGoogleError={() => setShowAccount(true)}
         onTelegramAuth={handleTelegramAuth}
      />
   );
   const orDivider = <DividerWithText text="OR" lineColor="#D9D2E1" textColor="#877897" />;
   // Normal browser, email not opened yet: only Facebook, the tiles and "Use email instead".
   const emailHidden = emailCollapsible && !emailOpen;
   const helpLink = messengerSupportLinkProps('signin_help');

   const passwordForm = (
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
         <AuthInputField
            label={emailOrPhone ? 'Email or mobile number' : 'Email'}
            type={emailOrPhone ? 'text' : 'email'}
            placeholder={emailOrPhone ? 'Email or 0917 123 4567' : 'Email'}
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
               setIdentifierError(null);
               handleEmailChange(e);
            }}
            error={Boolean(identifierError) || (showAccount && errorType !== 'provider_failed')}
            errorMessage={
               identifierError ??
               (showAccount && errorType === 'too_many_attempts'
                  ? 'Too many tries'
                  : showAccount && errorType === 'new_user'
                    ? 'No account with this email'
                    : showAccount && errorType === 'email_not_found'
                      ? 'No account with this email'
                      : showAccount && errorType === 'incorrect_credentials'
                        ? 'Wrong email or password'
                        : undefined)
            }
            icon={<Icons.email />}
            autoComplete={emailOrPhone ? 'username' : 'email'}
         />
         {/* Email-or-number box: the password shows once it's clearly an email. Kept on the
             page (just out of sight) so saved passwords still fill in. */}
         <div className={showPasswordFields ? 'flex flex-col gap-2' : 'sr-only'} aria-hidden={!showPasswordFields}>
            <AuthInputField
               label="Password"
               type="password"
               placeholder="Password"
               value={password}
               onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
               error={showAccount && errorType !== 'provider_failed'}
               icon={<Icons.lock />}
               showEyeToggle
               autoComplete="current-password"
            />
            <Link
               to="/forgot-password"
               className="self-end text-sm font-medium leading-5 tracking-[-0.02em] text-[#70617F] underline-offset-4 hover:text-[#6010D2] hover:underline"
            >
               Forgot password?
            </Link>
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

         <button
            type="submit"
            className="w-full h-14 rounded-2xl font-semibold text-[#FDFCFD] text-base tracking-[-0.02em] transition-opacity hover:opacity-95"
            style={{ backgroundColor: '#6010D2' }}
         >
            {showPasswordFields ? 'Sign in' : 'Continue'}
         </button>

         {/* Passwordless accounts (made in Facebook's browser) sign in here from any browser. A
             number typed in the box above goes to the text-code form by itself. */}
         <button
            type="button"
            onClick={() => switchToCode('email')}
            className="self-center text-sm font-semibold text-[#6010D2] underline underline-offset-4 dark:text-[#C084FC]"
         >
            Use a code instead
         </button>
      </form>
   );

   return (
      <div className="flex justify-center items-center min-h-screen py-6 sm:py-12 px-4">
         <div
            className="flex flex-col w-full max-w-[440px] min-h-[calc(100vh-3rem)] sm:min-h-[calc(100vh-6rem)] rounded-[20px] overflow-y-auto shrink-0"
            style={{
               // background: 'linear-gradient(180deg, #FBFAFD 0%, #FFFFFF 100%)',
               isolation: 'isolate'
            }}
         >
            {/* From Indonesia: the Telegram sign-up at /id (other methods stay below). */}
            <IdEntryBanner />
            {/* Content sits low (thumb reach); one short title, no subtitle (George, 2026-11-25: fewer words). */}
            <div className="flex flex-1 flex-col items-center justify-end sm:justify-center w-full px-5 py-6 sm:py-10">
               <img src="/auth-screen.png" alt="Moodeng Mascot" className="w-[80px] h-[70px] object-contain mb-4" />
               <h1 className="text-[32px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] text-center mb-7 dark:text-[#F0EAFF]">
                  Welcome back
               </h1>

               <div className="w-full flex flex-col gap-4">
                  {/* Kill switch off (no Facebook login): the older Google-button layout. */}
                  {!showFacebookOnTop && !inApp.isInApp && !phoneFirst ? socialAuth : null}
                  {!showFacebookOnTop && !inApp.isInApp && !phoneFirst ? orDivider : null}

                  {/* Facebook leads: bold where the rest is quiet; on the +63 page and in Messenger it steps back
                      for people who last used a phone/email code (facebookLeads). */}
                  {showFacebookOnTop && !(emailCollapsible && emailOpen) ? (
                     <div className="flex justify-center">
                        <FacebookAuthButton isSignUp={false} variant="full" bold={emailCollapsible || facebookLeads} />
                     </div>
                  ) : null}
                  {showFacebookOnTop && (inApp.isInApp || phoneFirst) ? orDivider : null}

                  {emailHidden ? (
                     <>
                        {socialAuth}
                        <button
                           type="button"
                           onClick={() => {
                              handleRetry();
                              setUsePassword(false);
                              setCodeChannel('email');
                              setEmailOpen(true);
                           }}
                           className="self-center text-[15px] font-semibold text-[#6010D2] underline-offset-4 hover:underline dark:text-[#C084FC]"
                        >
                           Use email instead
                        </button>
                     </>
                  ) : null}

                  {!emailHidden && !usePassword ? (
                     <div className="flex justify-center">
                        <PasswordlessAuthForm
                           key={`${codeChannel ?? 'default'}-${codePhone}`}
                           mode="signin"
                           inApp={inApp}
                           initialChannel={codeChannel}
                           initialPhone={codePhone}
                           quietSubmit={facebookLeads}
                           compact
                           // Facebook/Messenger: kept short; anyone with a password can still use a code.
                           onUsePassword={facebookInApp ? undefined : () => setUsePassword(true)}
                        />
                     </div>
                  ) : null}

                  {!emailHidden && usePassword ? passwordForm : null}

                  {/* +63 page: the small tiles right under the number box (no second OR). */}
                  {phoneFirst ? socialAuth : null}

                  {emailCollapsible && emailOpen ? (
                     <button
                        type="button"
                        onClick={() => {
                           handleRetry();
                           setEmailOpen(false);
                        }}
                        className="flex items-center gap-1.5 self-center text-sm font-medium text-[#70617F] hover:text-[#6010D2] dark:text-[#A89BB8]"
                     >
                        <ArrowLeft className="h-4 w-4" aria-hidden />
                        Other ways to sign in
                     </button>
                  ) : null}

                  {/* Google and Telegram can't sign in inside Facebook/Messenger: left out there. */}
                  {inApp.isInApp && !facebookInApp ? orDivider : null}
                  {inApp.isInApp && !facebookInApp ? socialAuth : null}

                  {/* One quiet line: sign up, and help on Messenger (the team answers in Discord tickets). */}
                  <div className="mt-3 flex w-full items-center justify-between text-sm tracking-[-0.02em] text-[#70617F] dark:text-[#A89BB8]">
                     <span>
                        New?{' '}
                        <Link to="/sign-up" className="font-semibold text-[#6010D2] underline-offset-4 hover:underline dark:text-[#C084FC]">
                           Sign up
                        </Link>
                     </span>
                     <a {...helpLink} className="flex items-center gap-1.5 font-medium hover:text-[#6010D2]">
                        <span className="size-[18px]">
                           <MessengerGlyph />
                        </span>
                        Need help?
                     </a>
                  </div>
               </div>
            </div>

            <AuthFooter short={facebookInApp} />
         </div>
      </div>
   );
}
