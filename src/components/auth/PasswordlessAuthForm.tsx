import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { ChevronDown, LoaderCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PhFlag } from '@/components/auth/PhFlag';

import { useResendCooldown } from '@/hooks/useResendCooldown';

import {
   buildEmailConfirmationPath,
   buildPhoneCodePath,
   PENDING_VERIFICATION_EMAIL_KEY,
   SIGNUP_RESEND_STORAGE_KEY,
   SMS_RESEND_STORAGE_KEY
} from '@/lib/authPaths';
import { buildAndroidIntentUrl, type InAppBrowserInfo, isFacebookInApp, openInSafari, setInAppNoticeHidden } from '@/lib/inAppBrowser';
import { isLikelyPhilippines } from '@/lib/isLikelyPhilippines';
import { getLastUsedAuth } from '@/lib/lastUsedAuth';
import { describeOtpError } from '@/lib/otpErrors';
import { savePendingCode } from '@/lib/pendingCode';
import { checkPhPhone, isSmsLoginEnabled, phNetwork, SMS_NON_PH_MESSAGE } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { GuestEmailTakenError, type OtpChannel, type OtpMode, requestOtpCode, startGuestSignup } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

type Props = {
   mode: OtpMode;
   inApp: InAppBrowserInfo;
   initialEmail?: string;
   /** Start in this mode (e.g. the sign-in page's "Text me a code" button). */
   initialChannel?: OtpChannel;
   /** A number already typed elsewhere (the sign-in page's email box): opens on phone with it. */
   initialPhone?: string;
   /** Sign-in only: show "Use password instead" for people who set a password. */
   onUsePassword?: () => void;
};

// Same screen a brand-new account lands on after verifying a code.
const GUEST_CREATED_PATH = '/auth-success?type=created&new=1';

const inAppName = (inApp: InAppBrowserInfo) => (inApp.isInApp ? (inApp.appName ?? 'unknown') : null);

// Typing a letter or "@" means an email; digits (or +) mean a phone number.
const looksLikeEmail = (value: string) => /[a-z@]/i.test(value);
const looksLikePhone = (value: string) => /^\s*\+?[\d\s\-().]+$/.test(value) && /\d/.test(value);

/** Phone or email to start with: the way they logged in last time, else phone for visitors in the Philippines. */
export function pickInitialChannel(options: {
   smsEnabled: boolean;
   initialChannel?: OtpChannel;
   initialEmail?: string;
   method?: string | null;
   lastUsed?: string | null;
   inPhilippines: boolean;
}): OtpChannel {
   if (!options.smsEnabled || options.initialEmail) return 'email';
   if (options.initialChannel) return options.initialChannel;
   if (options.method === 'phone') return 'sms';
   if (options.method === 'email') return 'email';
   if (options.lastUsed === 'phone') return 'sms';
   if (options.lastUsed === 'email' || options.lastUsed === 'google') return 'email';
   return options.inPhilippines ? 'sms' : 'email';
}

/**
 * One way in for sign-up and sign-in: one field that takes a Philippine mobile number (SMS code)
 * or an email (email code). The pill on the left shows which ("🇵🇭 +63 ▾" / "✉️ ▾") and switches
 * it; typing a letter or "@" switches to email, digits to phone. Sign-up creates the account;
 * sign-in never does. The code screen is /auth/verify-code.
 */
export function PasswordlessAuthForm({ mode, inApp, initialEmail = '', initialChannel, initialPhone = '', onUsePassword }: Props) {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const [searchParams] = useSearchParams();
   const smsEnabled = useMemo(() => isSmsLoginEnabled(), []);
   const [channel, setChannel] = useState<OtpChannel>(() =>
      pickInitialChannel({
         smsEnabled,
         initialChannel: initialPhone ? 'sms' : initialChannel,
         initialEmail,
         method: searchParams.get('method'),
         lastUsed: getLastUsedAuth(),
         inPhilippines: isLikelyPhilippines()
      })
   );
   const [value, setValue] = useState(initialEmail || initialPhone);
   const [error, setError] = useState<string | null>(null);
   const [notice, setNotice] = useState<string | null>(null);
   const [noAccount, setNoAccount] = useState(false);
   const [isSending, setIsSending] = useState(false);
   // After "Philippine numbers only", typing digits must not flip straight back to phone.
   const [stayOnEmail, setStayOnEmail] = useState(false);
   const inputRef = useRef<HTMLInputElement>(null);
   const emailCooldown = useResendCooldown(SIGNUP_RESEND_STORAGE_KEY);
   const smsCooldown = useResendCooldown(SMS_RESEND_STORAGE_KEY);
   const facebookInApp = isFacebookInApp(inApp);
   const isSms = channel === 'sms';
   // Email-first sign-up (guest account, no code until after Facebook) — in-app browsers only,
   // behind the guest_signup_enabled setting.
   const [guestSignupEnabled, setGuestSignupEnabled] = useState(false);
   const [emailTaken, setEmailTaken] = useState(false);
   // UniSMS's shared sender can't text Smart, TNT or Sun numbers, so a Smart-looking prefix goes
   // straight to "use email". A number that moved off Smart is rare; email works for them too.
   const phoneCheck = isSms ? checkPhPhone(value) : null;
   const network = phoneCheck?.kind === 'ok' ? phNetwork(phoneCheck.e164) : null;
   const smartBlocked = network === 'smart';
   useEffect(() => {
      if (mode !== 'signup' || !inApp.isInApp) return;
      let cancelled = false;
      void Promise.resolve(getSupabaseBrowserClient().rpc('get_guest_signup_enabled'))
         .then(({ data }) => {
            if (!cancelled) setGuestSignupEnabled(data === true);
         })
         .catch(() => undefined);
      return () => {
         cancelled = true;
      };
   }, [mode, inApp.isInApp]);

   // Carried over from the sign-in page's email box mid-typing: keep the keyboard up where they were.
   useEffect(() => {
      if (!initialPhone) return;
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // The "Open Moodeng in your browser" banner says Google doesn't work here, which reads as if
   // nothing works here. This form does, so the banner stays hidden on it.
   useEffect(() => {
      if (!inApp.isInApp) return;
      setInAppNoticeHidden(true);
      return () => setInAppNoticeHidden(false);
   }, [inApp.isInApp]);

   const switchTo = (next: OtpChannel, options: { keepValue?: boolean; message?: string | null; focus?: boolean } = {}) => {
      setChannel(next);
      if (!options.keepValue) setValue('');
      setNotice(options.message ?? null);
      setError(null);
      setNoAccount(false);
      if (next === 'sms') setStayOnEmail(false);
      if (options.focus !== false) window.requestAnimationFrame(() => inputRef.current?.focus());
   };

   const redirectNonPh = (source: 'input' | 'hook') => {
      if (import.meta.env.PROD) posthog.capture('sms_non_ph_redirected', { source, mode, in_app_browser: inAppName(inApp) });
      setStayOnEmail(true);
      switchTo('email', { message: SMS_NON_PH_MESSAGE });
   };

   const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setError(null);
      setNotice(null);
      setNoAccount(false);
      if (isSms) {
         if (looksLikeEmail(next)) {
            switchTo('email', { keepValue: true });
            setValue(next);
            return;
         }
         if (checkPhPhone(next).kind === 'non_ph') {
            redirectNonPh('input');
            return;
         }
      } else if (smsEnabled && !stayOnEmail && looksLikePhone(next)) {
         switchTo('sms', { keepValue: true });
         setValue(next);
         if (checkPhPhone(next).kind === 'non_ph') redirectNonPh('input');
         return;
      }
      setValue(next);
   };

   const trackRequested = (sentChannel: OtpChannel, target: string) => {
      if (!import.meta.env.PROD) return;
      const capture = (newUser: boolean | null) =>
         posthog.capture('otp_requested', { channel: sentChannel, new_user: newUser, mode, in_app_browser: inAppName(inApp) });
      if (sentChannel === 'sms') {
         // Unknown until the code is verified (no phone lookup from the browser).
         capture(null);
         return;
      }
      void Promise.resolve(getSupabaseBrowserClient().rpc('email_exists', { p_email: target }))
         .then(({ data, error: rpcError }) => capture(rpcError ? null : !data))
         .catch(() => capture(null));
   };

   const send = async (requestMode: OtpMode) => {
      setError(null);
      setNotice(null);
      setNoAccount(false);

      if (isSms) {
         const check = checkPhPhone(value);
         if (check.kind === 'non_ph') {
            redirectNonPh('input');
            return;
         }
         if (check.kind !== 'ok') {
            setError('Enter a Philippine mobile number, like 0917 123 4567.');
            return;
         }
         // Phone sign-up texts a code straight away (George, 2026-10-20): it lands on the same phone and
         // the keyboard offers it, so unlike an email code nobody has to leave Facebook.
         setIsSending(true);
         try {
            await dispatch(requestOtpCode({ channel: 'sms', phone: check.e164, mode: requestMode })).unwrap();
            smsCooldown.startCooldown();
            savePendingCode({ channel: 'sms', target: check.e164, mode: requestMode });
            trackRequested('sms', check.e164);
            navigate(buildPhoneCodePath(check.e164));
         } catch (err) {
            const view = describeOtpError(err, 'sms');
            if (view.nonPh) redirectNonPh('hook');
            else if (view.noAccount) {
               setNoAccount(true);
               setError(view.message);
            } else if (view.switchToEmail) {
               setStayOnEmail(true);
               switchTo('email', { message: view.message });
            } else setError(view.message);
         } finally {
            setIsSending(false);
         }
         return;
      }

      const email = value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
         setError('Enter your email address.');
         return;
      }
      if (import.meta.env.PROD && facebookInApp) {
         posthog.capture(mode === 'signup' ? 'signup_inapp_email_submitted' : 'signin_inapp_email_submitted', {
            app: inApp.appName,
            os: inApp.os
         });
      }
      setEmailTaken(false);
      if (requestMode === 'signup' && guestSignupEnabled) {
         setIsSending(true);
         try {
            await dispatch(startGuestSignup({ email })).unwrap();
            if (import.meta.env.PROD) posthog.capture('guest_signup_started', { in_app_browser: inAppName(inApp) });
            navigate(GUEST_CREATED_PATH, { replace: true });
         } catch (err) {
            if ((err as { name?: string })?.name === new GuestEmailTakenError().name) {
               setEmailTaken(true);
               setError('This email already has a Moodeng account. We can email you a code to sign in.');
            } else {
               setError(describeOtpError(err, 'email').message);
            }
         } finally {
            setIsSending(false);
         }
         return;
      }
      setIsSending(true);
      try {
         await dispatch(requestOtpCode({ channel: 'email', email, mode: requestMode })).unwrap();
         emailCooldown.startCooldown();
         sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, email);
         savePendingCode({ channel: 'email', target: email, mode: requestMode });
         trackRequested('email', email);
         navigate(buildEmailConfirmationPath(email));
      } catch (err) {
         const view = describeOtpError(err, 'email');
         setNoAccount(Boolean(view.noAccount));
         setError(view.message);
      } finally {
         setIsSending(false);
      }
   };

   const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void send(mode);
   };

   const browserName = inApp.os === 'ios' ? 'Safari' : 'Chrome';
   const helper = isSms
      ? "Globe, TM or DITO number. We'll text you a code."
      : mode === 'signup' && guestSignupEnabled
        ? // Email-first sign-up: no code now; they confirm the email after they're approved.
          'Used Google before? Type the same Gmail. No code needed now.'
        : inApp.isInApp
          ? "Used Google before? Type your Gmail and we'll email you a code."
          : "We'll email you a code.";

   return (
      <form onSubmit={handleSubmit} className="flex w-full max-w-[400px] flex-col gap-3" noValidate>
         <label htmlFor="otp-input" className="text-base font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F8F4FF]">
            {isSms ? 'Mobile number' : 'Email address'}
         </label>
         <div className="flex h-14 items-center gap-2 rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] pl-1.5 pr-4 shadow-[0_2px_4px_rgba(27,28,29,0.04)] focus-within:border-[#8336F0] dark:border-[#3D2D5A] dark:bg-[#1E1530]">
            <button
               type="button"
               onClick={() => (smsEnabled ? switchTo(isSms ? 'email' : 'sms') : undefined)}
               disabled={!smsEnabled}
               aria-label={smsEnabled ? (isSms ? 'Using phone. Switch to email' : 'Using email. Switch to phone') : 'Email'}
               className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-[#F2EEF7] px-2.5 text-base font-semibold text-[#250650] disabled:cursor-default dark:bg-[#2A1D40] dark:text-[#F8F4FF]"
            >
               {isSms ? <PhFlag /> : <span aria-hidden>✉️</span>}
               {isSms ? <span>+63</span> : null}
               {smsEnabled ? <ChevronDown className="h-4 w-4 text-[#70617F]" aria-hidden /> : null}
            </button>
            <input
               id="otp-input"
               ref={inputRef}
               type={isSms ? 'tel' : 'email'}
               inputMode={isSms ? 'tel' : 'email'}
               autoComplete={isSms ? 'tel-national' : 'email'}
               placeholder={isSms ? '0917 123 4567' : 'you@example.com'}
               value={value}
               onChange={handleChange}
               aria-describedby="otp-help"
               className="min-w-0 flex-1 bg-transparent text-base text-[#040033] outline-none placeholder:text-[#70617F] dark:text-[#F0EAFF] dark:placeholder:text-[#6B5880]"
            />
         </div>
         {isSms && (network === 'globe' || network === 'dito') ? (
            <p
               id="otp-help"
               role="status"
               className="rounded-2xl bg-[#E9F6EE] px-4 py-2.5 text-sm font-semibold leading-5 text-[#1B5E36] dark:bg-[#12301F] dark:text-[#8FE0AE]"
            >
               <span aria-hidden>✓ </span>
               {network === 'globe' ? "Globe or TM number · we'll text you a code" : "DITO number · we'll text you a code"}
            </p>
         ) : isSms && smartBlocked ? (
            <p
               id="otp-help"
               role="status"
               className="rounded-2xl bg-[#FDF1E3] px-4 py-2.5 text-sm font-semibold leading-5 text-[#7A4508] dark:bg-[#2A1E0A] dark:text-[#F3C77A]"
            >
               <span aria-hidden>✕ </span>
               Smart number · we can&apos;t text Smart yet
            </p>
         ) : (
            <p id="otp-help" className="text-sm leading-5 text-[#5b5470] dark:text-[#A89BB8]">
               {helper}
            </p>
         )}

         {notice ? (
            <p
               role="status"
               className="rounded-2xl border border-[#F8E08A] bg-[#FFF9E0] px-4 py-3 text-sm font-semibold leading-5 text-[#6B5500] dark:border-[#4A3D10] dark:bg-[#2A230A] dark:text-[#F8D860]"
            >
               {notice}
            </p>
         ) : null}
         {error ? (
            <div
               role="alert"
               className="rounded-2xl border border-[#FFD2D8] bg-[#FFF0F2] px-4 py-3 text-sm font-semibold leading-5 text-[#B60413] dark:border-[#4A1A20] dark:bg-[#2A0F14] dark:text-[#FF8090]"
            >
               <p>{error}</p>
               {emailTaken ? (
                  <button
                     type="button"
                     onClick={() => void send('signin')}
                     className="mt-2 rounded-xl bg-[#6010D2] px-3 py-2 text-sm font-semibold text-white"
                  >
                     Email me a code
                  </button>
               ) : null}
               {noAccount ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                     <button
                        type="button"
                        onClick={() => void send('signup')}
                        className="rounded-xl bg-[#6010D2] px-3 py-2 text-sm font-semibold text-white"
                     >
                        Create account
                     </button>
                     {smsEnabled ? (
                        <button
                           type="button"
                           onClick={() => switchTo(isSms ? 'email' : 'sms')}
                           className="rounded-xl border border-[#B5ACBE] bg-white px-3 py-2 text-sm font-semibold text-[#250650] dark:bg-transparent dark:text-[#F8F4FF]"
                        >
                           {isSms ? 'Use email instead' : 'Use phone instead'}
                        </button>
                     ) : null}
                  </div>
               ) : null}
            </div>
         ) : null}

         {smartBlocked ? (
            <button
               key="smart-use-email"
               type="button"
               onClick={(e) => {
                  // This button turns into the submit button on re-render; without this the same tap
                  // would also submit the (now empty) email form.
                  e.preventDefault();
                  setStayOnEmail(true);
                  switchTo('email');
               }}
               className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition-opacity hover:opacity-95"
               style={{ backgroundColor: '#6010D2' }}
            >
               {mode === 'signup' ? 'Sign up with email' : 'Log in with email'}
            </button>
         ) : (
            <button
               key="submit"
               type="submit"
               disabled={isSending}
               className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition-opacity hover:opacity-95 disabled:opacity-70"
               style={{ backgroundColor: '#6010D2' }}
            >
               {isSending ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : null}
               {isSending ? 'Sending…' : mode === 'signup' ? 'Continue' : isSms ? 'Text me a code' : 'Email me a code'}
            </button>
         )}

         {/* One line of "instead" links: phone screen offers email; email screen offers phone and,
             on sign-in, a password (passwords go with an email). */}
         {(smsEnabled && !smartBlocked) || (onUsePassword && !isSms) ? (
            <p className="self-center text-center text-sm text-[#70617F] dark:text-[#A89BB8]">
               Use{' '}
               {smsEnabled && !smartBlocked ? (
                  <button
                     type="button"
                     onClick={() => switchTo(isSms ? 'email' : 'sms')}
                     className="font-semibold text-[#6010D2] underline underline-offset-4 dark:text-[#C084FC]"
                  >
                     {isSms ? 'email' : 'phone number'}
                  </button>
               ) : null}
               {smsEnabled && !smartBlocked && onUsePassword && !isSms ? ' or ' : null}
               {onUsePassword && !isSms ? (
                  <button
                     type="button"
                     onClick={onUsePassword}
                     className="font-semibold text-[#6010D2] underline underline-offset-4 dark:text-[#C084FC]"
                  >
                     password
                  </button>
               ) : null}{' '}
               instead
            </p>
         ) : null}

         {/* Not in Facebook/Messenger: kept short there (George, 2026-10-19). */}
         {inApp.isInApp && !facebookInApp ? (
            <p className="text-center text-xs leading-5 text-[#70617F] dark:text-[#A89BB8]">
               Signed up with Telegram or LINE?{' '}
               {inApp.os === 'android' ? (
                  <a
                     href={buildAndroidIntentUrl(window.location.href)}
                     className="font-semibold text-[#6010D2] underline underline-offset-2 dark:text-[#C084FC]"
                  >
                     Open in Chrome
                  </a>
               ) : (
                  <button
                     type="button"
                     onClick={() => openInSafari(window.location.href, inApp)}
                     className="font-semibold text-[#6010D2] underline underline-offset-2 dark:text-[#C084FC]"
                  >
                     Open in {browserName}
                  </button>
               )}
               .
            </p>
         ) : null}
      </form>
   );
}
