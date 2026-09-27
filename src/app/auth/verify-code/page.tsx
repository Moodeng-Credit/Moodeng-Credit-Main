import { type ChangeEvent, type FormEvent, type JSX, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ArrowLeft, CheckCircle2, HelpCircle, Mail, RefreshCcw } from 'lucide-react';

import Loading from '@/components/Loading';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useResendCooldown } from '@/hooks/useResendCooldown';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { PENDING_VERIFICATION_EMAIL_KEY, SIGNUP_RESEND_STORAGE_KEY } from '@/lib/authPaths';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import { fetchUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';

const CREATED_PATH = '/auth-success?type=created';
const CODE_LENGTH = 8;

function normalizeCode(value: string): string {
   return value.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export default function AuthVerifyCodePage(): JSX.Element {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const [searchParams] = useSearchParams();
   const queryEmail = searchParams.get('email')?.trim() ?? '';
   const storedEmail =
      typeof window !== 'undefined' ? sessionStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY)?.trim() ?? '' : '';
   const [email, setEmail] = useState(queryEmail || storedEmail);
   const [code, setCode] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [message, setMessage] = useState<string | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isResending, setIsResending] = useState(false);
   const { isCoolingDown, secondsLeft, startCooldown } = useResendCooldown(SIGNUP_RESEND_STORAGE_KEY);
   const emailInputRef = useRef<HTMLInputElement>(null);
   const codeInputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
      if (queryEmail) {
         sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, queryEmail);
      }
   }, [queryEmail]);

   // Land the user straight in the field they need to fill next: the code if we
   // already know their email, otherwise the email field itself.
   useEffect(() => {
      if (email.trim()) {
         codeInputRef.current?.focus();
      } else {
         emailInputRef.current?.focus();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
      setEmail(event.target.value);
      setError(null);
      setMessage(null);
   };

   const handleCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
      setCode(normalizeCode(event.target.value));
      setError(null);
   };

   const finishVerification = async () => {
      const user = await dispatch(fetchUser()).unwrap().catch(() => null);
      sessionStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
      navigate(user?.userRole ? '/dashboard' : CREATED_PATH, { replace: true });
   };

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setMessage(null);

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
         setError('Enter the email address you used to sign up.');
         return;
      }

      if (code.length !== CODE_LENGTH) {
         setError(`Enter the ${CODE_LENGTH}-digit code from your email.`);
         return;
      }

      if (!isSupabaseBrowserConfigured()) {
         setError('Email verification is not configured in this local app.');
         return;
      }

      setIsSubmitting(true);
      try {
         const supabase = getSupabaseBrowserClient();
         const { error: verifyError } = await supabase.auth.verifyOtp({
            email: trimmedEmail,
            token: code,
            type: 'signup'
         });

         if (verifyError) {
            setError('That code did not work. Check the latest email from Moodeng and try again.');
            return;
         }

         await finishVerification();
      } finally {
         setIsSubmitting(false);
      }
   };

   const handleResend = async () => {
      setError(null);
      setMessage(null);

      if (isCoolingDown) return;

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
         setError('Enter your email first, then resend the code.');
         return;
      }

      if (!isSupabaseBrowserConfigured()) {
         setError('Email verification is not configured in this local app.');
         return;
      }

      setIsResending(true);
      try {
         const supabase = getSupabaseBrowserClient();
         const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: trimmedEmail,
            options: {
               emailRedirectTo: getAuthRedirectUrl()
            }
         });

         if (resendError) {
            setError(resendError.message || 'Could not resend the code. Try again in a moment.');
            return;
         }

         sessionStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, trimmedEmail);
         startCooldown();
         setMessage('New code sent. Use the latest email from Moodeng.');
      } finally {
         setIsResending(false);
      }
   };

   if (isSubmitting) {
      return <Loading />;
   }

   return (
      <div className="min-h-screen bg-[#FBFAFD] px-4 py-6 text-[#040033] dark:bg-[#0D0B14] dark:text-[#F0EAFF] sm:px-6 sm:py-10">
         <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[480px] flex-col">
            <div className="mb-5 flex items-center justify-between">
               <Link
                  to="/sign-up"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDFCFD] text-[#6010D2] shadow-[0_8px_24px_rgba(36,14,62,0.08)] transition hover:bg-[#F2EAFE] dark:bg-[#1E1530] dark:text-[#C084FC] dark:hover:bg-[#2A1D40]"
                  aria-label="Back to sign up"
               >
                  <ArrowLeft className="h-6 w-6" />
               </Link>
               <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Link
                     to="/support/faq"
                     className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDFCFD] text-[#6010D2] shadow-[0_8px_24px_rgba(36,14,62,0.08)] transition hover:bg-[#F2EAFE] dark:bg-[#1E1530] dark:text-[#C084FC] dark:hover:bg-[#2A1D40]"
                     aria-label="Help"
                  >
                     <HelpCircle className="h-6 w-6" />
                  </Link>
               </div>
            </div>

            <main className="flex flex-1 flex-col justify-center">
               <section className="rounded-[28px] border border-[#E7D8FF] bg-[#FDFCFD] px-5 py-7 shadow-[0_18px_50px_rgba(36,14,62,0.08)] dark:border-[#2D1F4A] dark:bg-[#160F28] sm:px-7">
                  <div className="mb-7 flex flex-col items-center text-center">
                     <div className="mb-5 flex h-[196px] w-[196px] items-center justify-center overflow-hidden rounded-[28px] border border-[#DCC7FF] bg-white shadow-[0_12px_28px_rgba(36,14,62,0.06)] dark:border-[#2D1F4A] dark:bg-[#1E1530]">
                        <img
                           src="/hippos/hippo-purple-envelope-email.png"
                           alt="Moodeng holding an envelope"
                           className="h-full w-full object-contain drop-shadow-[0_12px_22px_rgba(36,14,62,0.10)]"
                        />
                     </div>
                     <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#8336F0] dark:text-[#C084FC]">
                        Welcome to Moodeng
                     </p>
                     <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#040033] dark:text-[#F0EAFF]">
                        Confirm your email
                     </h1>
                     <p className="mt-3 max-w-[340px] text-base font-medium leading-6 tracking-[-0.02em] text-[#70617F] dark:text-[#A89BB8]">
                        Enter the 8-digit code from the latest Moodeng email to finish setting up your account.
                     </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
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
                              onChange={handleEmailChange}
                              placeholder="you@example.com"
                              autoComplete="email"
                              className="min-w-0 flex-1 bg-transparent text-base text-[#040033] outline-none placeholder:text-[#70617F] dark:text-[#F0EAFF] dark:placeholder:text-[#6B5880]"
                           />
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label
                           htmlFor="verification-code"
                           className="text-base font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F0EAFF]"
                        >
                           Verification code
                        </label>
                        <input
                           id="verification-code"
                           ref={codeInputRef}
                           type="text"
                           inputMode="numeric"
                           autoComplete="one-time-code"
                           value={code}
                           onChange={handleCodeChange}
                           placeholder="00000000"
                           className="h-16 w-full rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-5 text-center text-[30px] font-semibold tracking-[0.18em] text-[#040033] shadow-[0_2px_4px_rgba(27,28,29,0.04)] outline-none placeholder:text-[#A99CB4] focus:border-[#8336F0] focus:ring-4 focus:ring-[#E9D8FF] dark:border-[#3D2D5A] dark:bg-[#1E1530] dark:text-[#F0EAFF] dark:placeholder:text-[#6B5880] dark:focus:border-[#C084FC] dark:focus:ring-[#2D1F4A]"
                        />
                     </div>

                     {error ? (
                        <p className="rounded-2xl border border-[#FFD2D8] bg-[#FFF0F2] px-4 py-3 text-sm font-semibold leading-5 text-[#B60413] dark:border-[#4A1A20] dark:bg-[#2A0F14] dark:text-[#FF8090]">
                           {error}
                        </p>
                     ) : null}
                     {message ? (
                        <p className="flex items-start gap-3 rounded-2xl border border-[#BCEFD0] bg-[#EDFFF4] px-4 py-3 text-sm font-semibold leading-5 text-[#0D7A3C] dark:border-[#1A4A30] dark:bg-[#0F2A1E] dark:text-[#5DFFA0]">
                           <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                           {message}
                        </p>
                     ) : null}

                     <button
                        type="submit"
                        disabled={code.length !== CODE_LENGTH || !email.trim()}
                        className="h-14 w-full rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95 disabled:bg-[#BDB5C7] disabled:text-[#FDFCFD] dark:disabled:bg-[#2D1F4A] dark:disabled:text-[#6B5880]"
                     >
                        Verify email
                     </button>
                  </form>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                     <button
                        type="button"
                        onClick={handleResend}
                        disabled={isResending || isCoolingDown}
                        className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#8336F0] text-sm font-semibold text-[#6010D2] transition hover:bg-[#F2EAFE] disabled:opacity-60 dark:text-[#C084FC] dark:hover:bg-[#2A1D40]"
                     >
                        <RefreshCcw className="h-4 w-4" />
                        {isResending ? 'Sending...' : isCoolingDown ? `Resend in ${secondsLeft}s` : 'Resend code'}
                     </button>
                     <Link
                        to="/sign-in"
                        className="flex h-12 items-center justify-center rounded-2xl border border-[#E0D7E8] text-sm font-semibold text-[#4D4359] transition hover:bg-[#F8F4FC] dark:border-[#2D1F4A] dark:text-[#A89BB8] dark:hover:bg-[#1E1530]"
                     >
                        Already verified? Log in
                     </Link>
                  </div>
               </section>
            </main>
         </div>
      </div>
   );
}
