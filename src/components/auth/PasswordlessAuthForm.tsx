import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Mail, Smartphone } from 'lucide-react';
import posthog from 'posthog-js';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AuthInputField } from '@/components/auth/AuthInputField';

import { useResendCooldown } from '@/hooks/useResendCooldown';

import {
   buildEmailConfirmationPath,
   buildPhoneCodePath,
   PENDING_VERIFICATION_EMAIL_KEY,
   SIGNUP_RESEND_STORAGE_KEY,
   SMS_RESEND_STORAGE_KEY
} from '@/lib/authPaths';
import { type InAppBrowserInfo, isFacebookInApp } from '@/lib/inAppBrowser';
import { isLikelyPhilippines } from '@/lib/isLikelyPhilippines';
import { describeOtpError } from '@/lib/otpErrors';
import { checkPhPhone, isSmsLoginEnabled, SMS_NON_PH_MESSAGE } from '@/lib/phoneAuth';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { type OtpChannel, requestOtpCode } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

type Props = {
   mode: 'signin' | 'signup';
   inApp: InAppBrowserInfo;
   initialEmail?: string;
   /** Open on this tab (e.g. the sign-in page's "Text me a code" button). */
   initialChannel?: OtpChannel;
   /** Sign-in only: show "Use password instead" for people who set a password. */
   onUsePassword?: () => void;
};

const inAppName = (inApp: InAppBrowserInfo) => (inApp.isInApp ? (inApp.appName ?? 'unknown') : null);

/**
 * One way in for sign-up and sign-in: a Philippine mobile number (SMS code) or an email (email
 * code). The code screen is /auth/verify-code. New numbers/emails get an account, existing ones
 * are signed in; nobody needs a password.
 */
export function PasswordlessAuthForm({ mode, inApp, initialEmail = '', initialChannel, onUsePassword }: Props) {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const [searchParams] = useSearchParams();
   const smsEnabled = useMemo(() => isSmsLoginEnabled(), []);
   // Phone first for visitors in the Philippines; ?method=email|phone picks the tab explicitly.
   const [channel, setChannel] = useState<OtpChannel>(() => {
      if (!smsEnabled || initialEmail) return 'email';
      if (initialChannel) return initialChannel;
      const method = searchParams.get('method');
      if (method === 'email' || method === 'phone') return method === 'phone' ? 'sms' : 'email';
      return isLikelyPhilippines() ? 'sms' : 'email';
   });
   const [phone, setPhone] = useState('');
   const [email, setEmail] = useState(initialEmail);
   const [error, setError] = useState<string | null>(null);
   const [notice, setNotice] = useState<string | null>(null);
   const [isSending, setIsSending] = useState(false);
   const [focusEmail, setFocusEmail] = useState(false);
   const emailFieldRef = useRef<HTMLDivElement>(null);
   const emailCooldown = useResendCooldown(SIGNUP_RESEND_STORAGE_KEY);
   const smsCooldown = useResendCooldown(SMS_RESEND_STORAGE_KEY);
   const facebookInApp = isFacebookInApp(inApp);

   useEffect(() => {
      if (!focusEmail || channel !== 'email') return;
      emailFieldRef.current?.querySelector('input')?.focus();
      setFocusEmail(false);
   }, [focusEmail, channel]);

   const switchToEmail = (message: string | null) => {
      setChannel('email');
      setNotice(message);
      setError(null);
      setFocusEmail(true);
   };

   const redirectNonPh = (source: 'input' | 'hook') => {
      if (import.meta.env.PROD) posthog.capture('sms_non_ph_redirected', { source, mode, in_app_browser: inAppName(inApp) });
      setPhone('');
      switchToEmail(SMS_NON_PH_MESSAGE);
   };

   const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
      setError(null);
      setNotice(null);
      if (checkPhPhone(e.target.value).kind === 'non_ph') {
         redirectNonPh('input');
         return;
      }
      setPhone(e.target.value);
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

   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setNotice(null);

      if (channel === 'sms') {
         const check = checkPhPhone(phone);
         if (check.kind === 'non_ph') {
            redirectNonPh('input');
            return;
         }
         if (check.kind !== 'ok') {
            setError('Enter a Philippine mobile number, like 0917 123 4567.');
            return;
         }
         setIsSending(true);
         try {
            await dispatch(requestOtpCode({ channel: 'sms', phone: check.e164 })).unwrap();
            smsCooldown.startCooldown();
            trackRequested('sms', check.e164);
            navigate(buildPhoneCodePath(check.e164));
         } catch (err) {
            const view = describeOtpError(err, 'sms');
            if (view.nonPh) redirectNonPh('hook');
            else if (view.switchToEmail) switchToEmail(view.message);
            else setError(view.message);
         } finally {
            setIsSending(false);
         }
         return;
      }

      const trimmedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
         setError('Enter your email address.');
         return;
      }
      if (import.meta.env.PROD && facebookInApp) {
         posthog.capture(mode === 'signup' ? 'signup_inapp_email_submitted' : 'signin_inapp_email_submitted', {
            app: inApp.appName,
            os: inApp.os
         });
      }
      setIsSending(true);
      try {
         await dispatch(requestOtpCode({ channel: 'email', email: trimmedEmail })).unwrap();
         emailCooldown.startCooldown();
         sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, trimmedEmail);
         trackRequested('email', trimmedEmail);
         navigate(buildEmailConfirmationPath(trimmedEmail));
      } catch (err) {
         setError(describeOtpError(err, 'email').message);
      } finally {
         setIsSending(false);
      }
   };

   const tabClass = (active: boolean) =>
      `flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-base font-semibold tracking-[-0.02em] transition-colors ${
         active
            ? 'bg-white text-[#250650] shadow-[0_2px_8px_rgba(36,14,62,0.10)] dark:bg-[#2A1D40] dark:text-[#F8F4FF]'
            : 'text-[#70617F] hover:text-[#250650] dark:text-[#A89BB8]'
      }`;

   return (
      <form onSubmit={handleSubmit} className="flex w-full max-w-[400px] flex-col gap-4" noValidate>
         {smsEnabled ? (
            <div role="tablist" aria-label="Get your code by" className="flex gap-1 rounded-2xl bg-[#F2EEF7] p-1 dark:bg-[#1E1530]">
               <button
                  type="button"
                  role="tab"
                  aria-selected={channel === 'sms'}
                  className={tabClass(channel === 'sms')}
                  onClick={() => {
                     setChannel('sms');
                     setError(null);
                     setNotice(null);
                  }}
               >
                  <Smartphone className="h-5 w-5" strokeWidth={1.8} />
                  Phone
               </button>
               <button
                  type="button"
                  role="tab"
                  aria-selected={channel === 'email'}
                  className={tabClass(channel === 'email')}
                  onClick={() => switchToEmail(null)}
               >
                  <Mail className="h-5 w-5" strokeWidth={1.8} />
                  Email
               </button>
            </div>
         ) : null}

         {channel === 'sms' ? (
            <div className="flex flex-col gap-2">
               <label htmlFor="otp-phone" className="text-base font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F8F4FF]">
                  Mobile number
               </label>
               <div className="flex h-14 items-center gap-3 rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-4 shadow-[0_2px_4px_rgba(27,28,29,0.04)] focus-within:border-[#8336F0] dark:border-[#3D2D5A] dark:bg-[#1E1530]">
                  <span className="shrink-0 text-base font-semibold text-[#250650] dark:text-[#F8F4FF]" aria-hidden>
                     🇵🇭 +63
                  </span>
                  <input
                     id="otp-phone"
                     type="tel"
                     inputMode="tel"
                     autoComplete="tel-national"
                     placeholder="917 123 4567"
                     value={phone}
                     onChange={handlePhoneChange}
                     aria-describedby="otp-phone-help"
                     className="min-w-0 flex-1 bg-transparent text-base text-[#040033] outline-none placeholder:text-[#70617F] dark:text-[#F0EAFF] dark:placeholder:text-[#6B5880]"
                  />
               </div>
               <p id="otp-phone-help" className="text-sm leading-5 text-[#5b5470] dark:text-[#A89BB8]">
                  Philippine numbers only for now. Not in the Philippines?{' '}
                  <button
                     type="button"
                     onClick={() => switchToEmail(null)}
                     className="font-semibold text-[#6010D2] underline underline-offset-2 dark:text-[#C084FC]"
                  >
                     Use email
                  </button>
                  .
               </p>
            </div>
         ) : (
            <div ref={emailFieldRef} className="flex flex-col gap-2">
               <AuthInputField
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                     setEmail(e.target.value);
                     setError(null);
                  }}
                  icon={<Mail className="h-5 w-5 text-[#8336F0]" strokeWidth={1.8} />}
                  autoComplete="email"
               />
               <p className="text-sm leading-5 text-[#5b5470] dark:text-[#A89BB8]">
                  {facebookInApp
                     ? `Works right here in ${inApp.appName}: we'll email you an 8-digit code.`
                     : "We'll email you an 8-digit code."}
               </p>
            </div>
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
            <p
               role="alert"
               className="rounded-2xl border border-[#FFD2D8] bg-[#FFF0F2] px-4 py-3 text-sm font-semibold leading-5 text-[#B60413] dark:border-[#4A1A20] dark:bg-[#2A0F14] dark:text-[#FF8090]"
            >
               {error}
            </p>
         ) : null}

         <button
            type="submit"
            disabled={isSending}
            className="h-14 w-full rounded-2xl text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition-opacity hover:opacity-95 disabled:opacity-60"
            style={{ backgroundColor: '#6010D2' }}
         >
            {isSending ? 'Sending…' : mode === 'signup' ? 'Continue' : channel === 'sms' ? 'Text me a code' : 'Email me a code'}
         </button>

         {onUsePassword ? (
            <button
               type="button"
               onClick={onUsePassword}
               className="self-center text-sm font-medium tracking-[-0.02em] text-[#70617F] underline-offset-4 hover:text-[#6010D2] hover:underline dark:text-[#A89BB8]"
            >
               Use password instead
            </button>
         ) : null}
      </form>
   );
}
