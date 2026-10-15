import { type ChangeEvent, type FormEvent, type JSX, useEffect, useMemo, useRef, useState } from 'react';

import { ArrowLeft, CheckCircle2, HelpCircle, LoaderCircle, Mail, RefreshCcw } from 'lucide-react';
import posthog from 'posthog-js';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { ThemeToggle } from '@/components/ThemeToggle';

import { useResendCooldown } from '@/hooks/useResendCooldown';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { PENDING_VERIFICATION_EMAIL_KEY, SIGNUP_RESEND_STORAGE_KEY, SMS_RESEND_STORAGE_KEY } from '@/lib/authPaths';
import { detectInAppBrowser, setInAppNoticeHidden } from '@/lib/inAppBrowser';
import { describeOtpError } from '@/lib/otpErrors';
import { clearPendingCode, type PendingCode, readPendingCode, savePendingCode } from '@/lib/pendingCode';
import {
   checkPhPhone,
   EMAIL_CODE_LENGTH,
   EMAIL_CODE_TTL_SECONDS,
   formatPhLocal,
   SMS_CODE_LENGTH,
   SMS_CODE_TTL_SECONDS
} from '@/lib/phoneAuth';
import { getPostSignInPath } from '@/lib/postSignInPath';
import { isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { requestOtpCode, verifyOtpCode } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

// New accounts go to the account-created step; ?new=1 lets it ask "New to Moodeng?" first.
const CREATED_PATH = '/auth-success?type=created&new=1';

// Waiting help for a code that hasn't arrived: tips after 30s, Resend at 60s (the cooldown),
// and after two resends the way out (email instead, or a person on Messenger).
const TIP_AFTER_SECONDS = 30;
const WAY_OUT_AFTER_RESENDS = 2;

function onlyDigits(value: string, max: number): string {
   return value.replace(/\D/g, '').slice(0, max);
}

/** "Expired" vs "wrong": Supabase answers "expired or invalid" for both, so use when it was sent. */
export function describeRefusedCode(isSms: boolean, sentAt: number | null, now = Date.now()): string {
   const ttl = (isSms ? SMS_CODE_TTL_SECONDS : EMAIL_CODE_TTL_SECONDS) * 1000;
   if (sentAt !== null && now - sentAt > ttl) return 'This code expired. Tap Resend for a new one.';
   return isSms ? 'That code is wrong. Check the latest text from Moodeng.' : 'That code is wrong. Check the latest email from Moodeng.';
}

export default function AuthVerifyCodePage(): JSX.Element {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const [searchParams] = useSearchParams();

   // What we're waiting for: from the URL, or (a killed Facebook page coming back) from storage.
   const [pending, setPending] = useState<PendingCode | null>(() => readPendingCode());
   const phoneCheck = checkPhPhone(searchParams.get('phone') ?? '');
   const queryEmail = searchParams.get('email')?.trim() ?? '';
   const phone = phoneCheck.kind === 'ok' ? phoneCheck.e164 : !queryEmail && pending?.channel === 'sms' ? pending.target : null;
   const isSms = phone !== null;
   const storedEmail = typeof window !== 'undefined' ? (sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)?.trim() ?? '') : '';
   const [email, setEmail] = useState(queryEmail || storedEmail || (pending?.channel === 'email' ? pending.target : ''));
   const target = isSms ? phone : email.trim().toLowerCase();
   const matchingPending = pending && pending.target === target ? pending : null;
   const codeLength = isSms ? SMS_CODE_LENGTH : EMAIL_CODE_LENGTH;

   const [code, setCode] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [message, setMessage] = useState<string | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isResending, setIsResending] = useState(false);
   const [showLoginHint, setShowLoginHint] = useState(false);
   const [now, setNow] = useState(() => Date.now());
   const pageOpenedAt = useMemo(() => Date.now(), []);
   const { isCoolingDown, secondsLeft, startCooldown } = useResendCooldown(isSms ? SMS_RESEND_STORAGE_KEY : SIGNUP_RESEND_STORAGE_KEY);
   const emailInputRef = useRef<HTMLInputElement>(null);
   const codeInputRef = useRef<HTMLInputElement>(null);
   const lastAutoSubmitted = useRef<string | null>(null);
   const inApp = useMemo(() => detectInAppBrowser(), []);

   useEffect(() => {
      if (queryEmail) sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, queryEmail);
   }, [queryEmail]);

   // Same as the sign-in form: the "open in your browser" banner would say this doesn't work here.
   useEffect(() => {
      if (!inApp.isInApp) return;
      setInAppNoticeHidden(true);
      return () => setInAppNoticeHidden(false);
   }, [inApp.isInApp]);

   // Tick once a second for the waiting help.
   useEffect(() => {
      const timer = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(timer);
   }, []);

   // Land in the field they need next: the code if we know where it went, else the email.
   useEffect(() => {
      if (isSms || email.trim()) codeInputRef.current?.focus();
      else emailInputRef.current?.focus();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const sentAt = matchingPending?.sentAt ?? null;
   const waitedSeconds = Math.floor((now - (sentAt ?? pageOpenedAt)) / 1000);
   const resends = matchingPending?.resends ?? 0;

   // Back to the form they came from (sign-up or sign-in), or the sign-in page on a fresh tab.
   const goBackToChange = () => {
      const historyIdx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (historyIdx > 0) navigate(-1);
      else navigate(isSms ? '/sign-in?method=phone' : '/sign-in?method=email');
   };

   const submitCode = async (token: string) => {
      setError(null);
      setMessage(null);
      setShowLoginHint(false);

      const trimmedEmail = email.trim().toLowerCase();
      if (!isSms && !trimmedEmail) {
         setError('Enter the email address the code was sent to.');
         return;
      }
      if (token.length < codeLength) {
         setError(isSms ? `Enter the ${codeLength}-digit code from the text.` : `Enter the ${codeLength}-digit code from your email.`);
         return;
      }
      if (!isSupabaseBrowserConfigured()) {
         setError('Sign-in codes are not configured in this local app.');
         return;
      }

      setIsSubmitting(true);
      try {
         const { user, isNewUser } = await dispatch(
            verifyOtpCode(phone ? { channel: 'sms', phone, token } : { channel: 'email', email: trimmedEmail, token })
         ).unwrap();
         if (import.meta.env.PROD) {
            posthog.capture('otp_verified', {
               channel: isSms ? 'sms' : 'email',
               new_user: isNewUser,
               in_app_browser: inApp.isInApp ? (inApp.appName ?? 'unknown') : null
            });
         }
         sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
         clearPendingCode();
         // A brand-new account → account created. An existing one → where they were going, or the
         // role screen if they never picked one (not "Account created" again).
         const next = isNewUser ? CREATED_PATH : user.userRole ? await getPostSignInPath(user) : '/onboarding/role';
         navigate(next, { replace: true });
      } catch (err) {
         const lower = String((err as { message?: unknown })?.message ?? '').toLowerCase();
         if (lower.includes('expired') || lower.includes('invalid') || lower.includes('token')) {
            setError(describeRefusedCode(isSms, sentAt));
            // Tapping Confirm Email in the email (often in another browser) uses up the same one-time
            // code, so the code then fails here even though they are signed in over there.
            setShowLoginHint(!isSms);
         } else {
            setError(describeOtpError(err, isSms ? 'sms' : 'email').message);
         }
         setCode('');
         codeInputRef.current?.focus();
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
      const next = onlyDigits(event.target.value, codeLength);
      setCode(next);
      setError(null);
      // Last digit in (typed, pasted or filled from the SMS): check it straight away, once.
      if (next.length === codeLength && next !== lastAutoSubmitted.current && !isSubmitting) {
         lastAutoSubmitted.current = next;
         void submitCode(next);
      }
   };

   const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitCode(code);
   };

   const handleResend = async () => {
      setError(null);
      setMessage(null);
      if (isCoolingDown) return;

      const trimmedEmail = email.trim().toLowerCase();
      if (!isSms && !trimmedEmail) {
         setError('Enter your email first, then resend the code.');
         return;
      }
      if (!isSupabaseBrowserConfigured()) {
         setError('Sign-in codes are not configured in this local app.');
         return;
      }

      // Same mode as the first request (a sign-in resend must not create an account).
      const mode = matchingPending?.mode ?? 'signin';
      setIsResending(true);
      try {
         await dispatch(requestOtpCode(phone ? { channel: 'sms', phone, mode } : { channel: 'email', email: trimmedEmail, mode })).unwrap();
         if (!isSms) sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, trimmedEmail);
         setPending(savePendingCode({ channel: isSms ? 'sms' : 'email', target: phone ?? trimmedEmail, mode, resends: resends + 1 }));
         lastAutoSubmitted.current = null;
         startCooldown();
         setMessage(isSms ? 'New code sent. Use the latest text from Moodeng.' : 'New code sent. Use the latest email from Moodeng.');
      } catch (err) {
         setError(describeOtpError(err, isSms ? 'sms' : 'email').message);
      } finally {
         setIsResending(false);
      }
   };

   const messengerHelp =
      inApp.os === 'android' ? EXTERNAL_LINKS.support.messengerLoginCodeAndroid : EXTERNAL_LINKS.support.messengerLoginCode;
   const waitingHelp =
      waitedSeconds < TIP_AFTER_SECONDS
         ? 'Usually under a minute.'
         : isSms
           ? 'Not here yet? Look for a text from SEMAPHORE, check your signal and Messages › Spam.'
           : 'Not here yet? Check Spam and Promotions.';

   return (
      <div className="min-h-screen bg-[#FBFAFD] px-4 py-4 text-[#040033] dark:bg-[#0D0B14] dark:text-[#F0EAFF] sm:px-6 sm:py-10">
         <div className="mx-auto flex w-full max-w-[480px] flex-col">
            <div className="mb-3 flex items-center justify-between">
               <Link
                  to="/sign-in"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FDFCFD] text-[#6010D2] shadow-[0_8px_24px_rgba(36,14,62,0.08)] transition hover:bg-[#F2EAFE] dark:bg-[#1E1530] dark:text-[#C084FC] dark:hover:bg-[#2A1D40]"
                  aria-label="Back"
               >
                  <ArrowLeft className="h-5 w-5" />
               </Link>
               <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Link
                     to="/support/faq"
                     className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FDFCFD] text-[#6010D2] shadow-[0_8px_24px_rgba(36,14,62,0.08)] transition hover:bg-[#F2EAFE] dark:bg-[#1E1530] dark:text-[#C084FC] dark:hover:bg-[#2A1D40]"
                     aria-label="Help"
                  >
                     <HelpCircle className="h-5 w-5" />
                  </Link>
               </div>
            </div>

            <main>
               <section className="rounded-[28px] border border-[#E7D8FF] bg-[#FDFCFD] px-5 py-6 shadow-[0_18px_50px_rgba(36,14,62,0.08)] dark:border-[#2D1F4A] dark:bg-[#160F28] sm:px-7">
                  {/* Small hippo so the code field stays above the keyboard on small phones. */}
                  <div className="mb-4 flex items-center gap-3">
                     <img
                        src="/hippos/hippo-purple-envelope-email.png"
                        alt=""
                        aria-hidden
                        className="h-16 w-16 shrink-0 rounded-2xl border border-[#DCC7FF] bg-white object-contain dark:border-[#2D1F4A] dark:bg-[#1E1530]"
                     />
                     <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.04em] text-[#040033] dark:text-[#F0EAFF]">
                        {isSms ? 'Check your texts' : 'Check your email'}
                     </h1>
                  </div>

                  {isSms && phone ? (
                     <p className="text-[22px] font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F0EAFF]">
                        {formatPhLocal(phone)} <span className="text-base font-medium text-[#70617F]">·</span>{' '}
                        <button
                           type="button"
                           onClick={goBackToChange}
                           className="text-base font-semibold text-[#6010D2] underline-offset-2 hover:underline dark:text-[#C084FC]"
                        >
                           Change
                        </button>
                     </p>
                  ) : email.trim() && (queryEmail || storedEmail || matchingPending) ? (
                     <p className="break-all text-[20px] font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F0EAFF]">
                        {email.trim()} <span className="text-base font-medium text-[#70617F]">·</span>{' '}
                        <button
                           type="button"
                           onClick={goBackToChange}
                           className="text-base font-semibold text-[#6010D2] underline-offset-2 hover:underline dark:text-[#C084FC]"
                        >
                           Change
                        </button>
                     </p>
                  ) : (
                     <div className="space-y-2">
                        <label
                           htmlFor="verification-email"
                           className="text-base font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F0EAFF]"
                        >
                           Email address
                        </label>
                        <div className="flex h-14 items-center gap-3 rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-4 shadow-[0_2px_4px_rgba(27,28,29,0.04)] dark:border-[#3D2D5A] dark:bg-[#1E1530]">
                           <Mail className="h-5 w-5 shrink-0 text-[#8336F0] dark:text-[#C084FC]" strokeWidth={1.8} />
                           <input
                              id="verification-email"
                              ref={emailInputRef}
                              type="email"
                              value={email}
                              onChange={(event) => {
                                 setEmail(event.target.value);
                                 setError(null);
                                 setMessage(null);
                              }}
                              placeholder="you@example.com"
                              autoComplete="email"
                              className="min-w-0 flex-1 bg-transparent text-base text-[#040033] outline-none placeholder:text-[#70617F] dark:text-[#F0EAFF] dark:placeholder:text-[#6B5880]"
                           />
                        </div>
                     </div>
                  )}
                  {isSms ? (
                     // Until Semaphore approves the "Moodeng" sender name, every text shows SEMAPHORE as the
                     // sender, which reads like a scam unless we say so first.
                     <p className="mt-3 rounded-2xl border border-[#DCC7FF] bg-[#F3EFFE] px-4 py-3 text-sm font-medium leading-5 text-[#3D2A63] dark:border-[#40354F] dark:bg-[#281b35] dark:text-[#E4D8F7]">
                        <b>Look for a text from SEMAPHORE.</b> That&apos;s the company that sends our codes, so it&apos;s safe to
                        type the code here. Never share it with anyone.
                     </p>
                  ) : (
                     <p className="mt-2 text-sm font-medium leading-5 text-[#70617F] dark:text-[#A89BB8]">
                        Type the 8-digit code below, or tap Confirm Email in the latest Moodeng email.
                     </p>
                  )}

                  <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                     <div className="space-y-2">
                        <label
                           htmlFor="verification-code"
                           className="text-base font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F0EAFF]"
                        >
                           {isSms ? 'Code from the text' : 'Code from the email'}
                        </label>
                        <input
                           id="verification-code"
                           ref={codeInputRef}
                           type="text"
                           inputMode="numeric"
                           autoComplete="one-time-code"
                           maxLength={codeLength}
                           value={code}
                           onChange={handleCodeChange}
                           placeholder={'0'.repeat(codeLength)}
                           aria-describedby="verification-wait-help"
                           className="h-16 w-full rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-5 text-center text-[30px] font-semibold tracking-[0.18em] text-[#040033] shadow-[0_2px_4px_rgba(27,28,29,0.04)] outline-none placeholder:text-[#A99CB4] focus:border-[#8336F0] focus:ring-4 focus:ring-[#E9D8FF] dark:border-[#3D2D5A] dark:bg-[#1E1530] dark:text-[#F0EAFF] dark:placeholder:text-[#6B5880] dark:focus:border-[#C084FC] dark:focus:ring-[#2D1F4A]"
                        />
                        <p id="verification-wait-help" className="text-sm leading-5 text-[#5b5470] dark:text-[#A89BB8]">
                           {waitingHelp}
                        </p>
                     </div>

                     {error ? (
                        <p
                           role="alert"
                           className="rounded-2xl border border-[#FFD2D8] bg-[#FFF0F2] px-4 py-3 text-sm font-semibold leading-5 text-[#B60413] dark:border-[#4A1A20] dark:bg-[#2A0F14] dark:text-[#FF8090]"
                        >
                           {error}
                        </p>
                     ) : null}
                     {showLoginHint ? (
                        <p className="rounded-2xl border border-[#E7D8FF] bg-[#F8F4FC] px-4 py-3 text-sm font-medium leading-5 text-[#4D4359] dark:border-[#2D1F4A] dark:bg-[#1E1530] dark:text-[#A89BB8]">
                           Already tapped Confirm Email in the email? Your account is ready.{' '}
                           <Link to="/sign-in" className="font-semibold text-[#6010D2] underline underline-offset-2 dark:text-[#C084FC]">
                              Log in
                           </Link>
                        </p>
                     ) : null}
                     {message ? (
                        <p
                           role="status"
                           className="flex items-start gap-3 rounded-2xl border border-[#BCEFD0] bg-[#EDFFF4] px-4 py-3 text-sm font-semibold leading-5 text-[#0D7A3C] dark:border-[#1A4A30] dark:bg-[#0F2A1E] dark:text-[#5DFFA0]"
                        >
                           <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                           {message}
                        </p>
                     ) : null}

                     <button
                        type="submit"
                        disabled={isSubmitting || code.length < codeLength || (!isSms && !email.trim())}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95 disabled:bg-[#BDB5C7] disabled:text-[#FDFCFD] dark:disabled:bg-[#2D1F4A] dark:disabled:text-[#6B5880]"
                     >
                        {isSubmitting ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : null}
                        {isSubmitting ? 'Checking…' : 'Continue'}
                     </button>
                  </form>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                     <button
                        type="button"
                        onClick={handleResend}
                        disabled={isResending || isCoolingDown}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#8336F0] text-sm font-semibold text-[#6010D2] transition hover:bg-[#F2EAFE] disabled:opacity-60 dark:text-[#C084FC] dark:hover:bg-[#2A1D40]"
                     >
                        {isResending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCcw className="h-4 w-4" />}
                        {isResending ? 'Sending...' : isCoolingDown ? `Resend in ${secondsLeft}s` : 'Resend code'}
                     </button>
                     <Link
                        to={isSms ? '/sign-in?method=email' : '/sign-in'}
                        className="flex h-12 items-center justify-center rounded-2xl border border-[#E0D7E8] text-sm font-semibold text-[#4D4359] transition hover:bg-[#F8F4FC] dark:border-[#2D1F4A] dark:text-[#A89BB8] dark:hover:bg-[#1E1530]"
                     >
                        {isSms ? 'Use email instead' : 'Use phone or password'}
                     </Link>
                  </div>

                  {resends >= WAY_OUT_AFTER_RESENDS ? (
                     <div className="mt-4 rounded-2xl border border-[#E7D8FF] bg-[#F8F4FC] px-4 py-3 text-sm leading-5 text-[#4D4359] dark:border-[#2D1F4A] dark:bg-[#1E1530] dark:text-[#A89BB8]">
                        <p className="font-semibold">Still no code?</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                           {isSms ? (
                              <Link
                                 to="/sign-in?method=email"
                                 className="font-semibold text-[#6010D2] underline underline-offset-2 dark:text-[#C084FC]"
                              >
                                 Get the code by email instead
                              </Link>
                           ) : null}
                           <a
                              href={messengerHelp}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-[#6010D2] underline underline-offset-2 dark:text-[#C084FC]"
                           >
                              Message us on Messenger
                           </a>
                        </div>
                     </div>
                  ) : null}
               </section>
            </main>
         </div>
      </div>
   );
}
