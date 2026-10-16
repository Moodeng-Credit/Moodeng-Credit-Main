import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import posthog from 'posthog-js';
import { useDispatch, useSelector } from 'react-redux';

import { EXTERNAL_LINKS } from '@/config/externalLinks';
import { detectInAppBrowser } from '@/lib/inAppBrowser';
import { EMAIL_CODE_LENGTH, isGuestEmail } from '@/lib/phoneAuth';
import {
   confirmEmailChange,
   fetchUser,
   getGuestPendingEmail,
   GuestEmailTakenError,
   resendGuestEmail,
   setGuestPassword
} from '@/store/slices/authSlice';
import type { AppDispatch, RootState } from '@/store/store';

type Stage = 'code' | 'change' | 'password';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Guest accounts (email-first sign-up in Facebook's browser) confirm their email and set a password
 * here, right after connecting Facebook — so anyone stuck can message us on Messenger — and before
 * KYC or a loan (the database and create-didit-session refuse guests anyway). Shows over every page
 * until done. Confirming by the emailed link instead (any browser) also clears it.
 */
export function GuestAccountGate() {
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const needsConfirm = Boolean(user && isGuestEmail(user.email) && user.hasVerifiedContact);

   const [stage, setStage] = useState<Stage>('code');
   const [pendingEmail, setPendingEmail] = useState<string | null>(null);
   const [code, setCode] = useState('');
   const [newEmail, setNewEmail] = useState('');
   const [password, setPassword] = useState('');
   const [showPassword, setShowPassword] = useState(false);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [notice, setNotice] = useState<string | null>(null);
   const inApp = useMemo(() => detectInAppBrowser(), []);
   const helpLink = inApp.os === 'android' ? EXTERNAL_LINKS.support.messengerLoginCodeAndroid : EXTERNAL_LINKS.support.messengerLoginCode;

   useEffect(() => {
      if (!needsConfirm) return;
      let cancelled = false;
      void getGuestPendingEmail().then((email) => {
         if (!cancelled) setPendingEmail(email);
      });
      if (import.meta.env.PROD) posthog.capture('guest_confirm_shown');
      return () => {
         cancelled = true;
      };
   }, [needsConfirm]);

   // Stays up through the password step: confirming the code already swaps in the real email.
   if (!needsConfirm && stage !== 'password') return null;

   const run = async (task: () => Promise<void>) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
         await task();
      } catch (err) {
         if ((err as { name?: string })?.name === new GuestEmailTakenError().name) {
            setError('That email already has a Moodeng account. Use a different email, or message us.');
         } else {
            setError((err as { message?: string })?.message || 'Something went wrong. Try again.');
         }
      } finally {
         setBusy(false);
      }
   };

   const confirmCode = (e: FormEvent) => {
      e.preventDefault();
      if (!pendingEmail) return;
      if (code.length < EMAIL_CODE_LENGTH) {
         setError(`Enter the ${EMAIL_CODE_LENGTH}-digit code from your email.`);
         return;
      }
      void run(async () => {
         try {
            await dispatch(confirmEmailChange({ email: pendingEmail, token: code })).unwrap();
         } catch {
            throw new Error('That code is wrong or expired. Tap "Send a new code".');
         }
         if (import.meta.env.PROD) posthog.capture('guest_email_confirmed');
         setStage('password');
      });
   };

   const resend = (email: string) =>
      run(async () => {
         await resendGuestEmail(email);
         setPendingEmail(email);
         setCode('');
         setStage('code');
         setNotice(`We sent a new code to ${email}.`);
      });

   const savePassword = (e: FormEvent) => {
      e.preventDefault();
      if (password.length < MIN_PASSWORD_LENGTH) {
         setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
         return;
      }
      void run(async () => {
         await dispatch(setGuestPassword({ password })).unwrap();
         await dispatch(fetchUser());
         if (import.meta.env.PROD) posthog.capture('guest_password_set');
         setStage('code');
      });
   };

   const inputClass =
      'h-14 w-full rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-4 text-base text-[#040033] outline-none focus:border-[#8336F0] dark:border-[#3D2D5A] dark:bg-[#1E1530] dark:text-[#F0EAFF]';
   const primaryClass =
      'flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#6010D2] text-base font-semibold text-white disabled:opacity-70';
   const linkClass = 'self-center text-sm font-semibold text-[#6010D2] underline underline-offset-4 dark:text-[#C084FC]';

   return (
      <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-white px-4 py-10 dark:bg-[#120B1F]">
         <div className="flex w-full max-w-[400px] flex-col gap-4">
            {stage === 'password' ? (
               <>
                  <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#040033] dark:text-[#F8F4FF]">Email confirmed ✅</h1>
                  <p className="text-base text-[#4D4359] dark:text-[#C9BEDA]">
                     Last step: set a password so you can sign in from any phone or browser.
                  </p>
                  <form onSubmit={savePassword} className="flex flex-col gap-3" noValidate>
                     <label htmlFor="guest-password" className="text-base font-semibold text-[#040033] dark:text-[#F8F4FF]">
                        Password
                     </label>
                     <div className="relative">
                        <input
                           id="guest-password"
                           type={showPassword ? 'text' : 'password'}
                           autoComplete="new-password"
                           value={password}
                           onChange={(e) => {
                              setPassword(e.target.value);
                              setError(null);
                           }}
                           placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                           className={`${inputClass} pr-12`}
                        />
                        <button
                           type="button"
                           onClick={() => setShowPassword((v) => !v)}
                           aria-label={showPassword ? 'Hide password' : 'Show password'}
                           className="absolute right-3 top-1/2 -translate-y-1/2 text-[#70617F]"
                        >
                           {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                     </div>
                     {error ? <p role="alert" className="text-sm font-semibold text-[#B60413]">{error}</p> : null}
                     <button type="submit" disabled={busy} className={primaryClass}>
                        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : null}
                        Save password
                     </button>
                  </form>
               </>
            ) : (
               <>
                  <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#040033] dark:text-[#F8F4FF]">Confirm your email</h1>
                  <p className="text-base text-[#4D4359] dark:text-[#C9BEDA]">
                     Facebook is connected. Now confirm your email so you can request a loan.
                  </p>

                  {stage === 'change' ? (
                     <form
                        onSubmit={(e) => {
                           e.preventDefault();
                           const email = newEmail.trim().toLowerCase();
                           if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                              setError('Enter your email address.');
                              return;
                           }
                           void resend(email);
                        }}
                        className="flex flex-col gap-3"
                        noValidate
                     >
                        <label htmlFor="guest-new-email" className="text-base font-semibold text-[#040033] dark:text-[#F8F4FF]">
                           Your email
                        </label>
                        <input
                           id="guest-new-email"
                           type="email"
                           inputMode="email"
                           autoComplete="email"
                           value={newEmail}
                           onChange={(e) => {
                              setNewEmail(e.target.value);
                              setError(null);
                           }}
                           placeholder="you@example.com"
                           className={inputClass}
                        />
                        {error ? <p role="alert" className="text-sm font-semibold text-[#B60413]">{error}</p> : null}
                        <button type="submit" disabled={busy} className={primaryClass}>
                           {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : null}
                           Send code
                        </button>
                        <button type="button" onClick={() => setStage('code')} className={linkClass}>
                           Back
                        </button>
                     </form>
                  ) : (
                     <form onSubmit={confirmCode} className="flex flex-col gap-3" noValidate>
                        <p className="text-sm text-[#4D4359] dark:text-[#C9BEDA]">
                           We sent an {EMAIL_CODE_LENGTH}-digit code to <strong>{pendingEmail ?? 'your email'}</strong>. Check your
                           inbox and spam, then come back here.
                        </p>
                        <input
                           id="guest-code"
                           aria-label="Code from your email"
                           inputMode="numeric"
                           autoComplete="one-time-code"
                           maxLength={EMAIL_CODE_LENGTH}
                           value={code}
                           onChange={(e) => {
                              setCode(e.target.value.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH));
                              setError(null);
                           }}
                           placeholder={'•'.repeat(EMAIL_CODE_LENGTH)}
                           className={`${inputClass} text-center text-2xl tracking-[0.3em]`}
                        />
                        {notice ? <p role="status" className="text-sm font-semibold text-[#2E7D32]">{notice}</p> : null}
                        {error ? <p role="alert" className="text-sm font-semibold text-[#B60413]">{error}</p> : null}
                        <button type="submit" disabled={busy || !pendingEmail} className={primaryClass}>
                           {busy ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden /> : null}
                           Confirm email
                        </button>
                        <button type="button" disabled={busy || !pendingEmail} onClick={() => pendingEmail && void resend(pendingEmail)} className={linkClass}>
                           Send a new code
                        </button>
                        <button
                           type="button"
                           onClick={() => {
                              setNewEmail(pendingEmail ?? '');
                              setError(null);
                              setStage('change');
                           }}
                           className={linkClass}
                        >
                           Wrong email? Change it
                        </button>
                     </form>
                  )}

                  <a
                     href={helpLink}
                     target="_blank"
                     rel="noreferrer"
                     className="mt-2 rounded-2xl border border-[#B5ACBE] px-4 py-3 text-center text-sm font-semibold text-[#250650] dark:text-[#F8F4FF]"
                  >
                     Stuck? Message us on Messenger
                  </a>
               </>
            )}
         </div>
      </div>
   );
}
