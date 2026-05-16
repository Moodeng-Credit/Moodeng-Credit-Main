import { type FormEvent, type JSX, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, HelpCircle, KeyRound, Mail } from 'lucide-react';

import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

function normalizeCode(value: string): string {
   return value.replace(/\D/g, '').slice(0, 6);
}

export default function ForgotPasswordPage(): JSX.Element {
   const [email, setEmail] = useState('');
   const [code, setCode] = useState('');
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [message, setMessage] = useState('');
   const [error, setError] = useState('');
   const [loading, setLoading] = useState(false);
   const [hasRequestedReset, setHasRequestedReset] = useState(false);

   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage('');
      setError('');

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
         setError('Enter the email address on your Moodeng account.');
         return;
      }

      if (!isSupabaseBrowserConfigured()) {
         setError('Password reset is not configured in this local app.');
         return;
      }

      setLoading(true);
      try {
         const supabase = getSupabaseBrowserClient();
         const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
            redirectTo: getAuthRedirectUrl('/reset-password')
         });

         if (resetError) {
            setError(resetError.message || 'Could not send a reset code. Try again in a moment.');
            return;
         }

         setMessage('Check your email for the reset code, then enter it here.');
         setHasRequestedReset(true);
      } catch (resetRequestError) {
         setError(resetRequestError instanceof Error ? resetRequestError.message : 'Could not send a reset code. Try again in a moment.');
      } finally {
         setLoading(false);
      }
   };

   const handleCodeReset = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage('');
      setError('');

      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
         setError('Enter the email address on your Moodeng account.');
         return;
      }

      if (code.length !== 6) {
         setError('Enter the 6-digit code from your email.');
         return;
      }

      if (password.length < 6) {
         setError('Use at least 6 characters for your new password.');
         return;
      }

      if (password !== confirmPassword) {
         setError('Passwords do not match.');
         return;
      }

      if (!isSupabaseBrowserConfigured()) {
         setError('Password reset is not configured in this local app.');
         return;
      }

      setLoading(true);
      try {
         const supabase = getSupabaseBrowserClient();
         const { error: verifyError } = await supabase.auth.verifyOtp({
            email: trimmedEmail,
            token: code,
            type: 'recovery'
         });

         if (verifyError) {
            setError(verifyError.message || 'That reset code did not work. Use the latest email from Moodeng and try again.');
            return;
         }

         const { error: updateError } = await supabase.auth.updateUser({ password });
         if (updateError) {
            setError(updateError.message || 'Could not update your password. Try again in a moment.');
            return;
         }

         setMessage('Password updated. You can sign in with the new password now.');
         setCode('');
         setPassword('');
         setConfirmPassword('');
         window.setTimeout(() => {
            window.location.assign('/sign-in');
         }, 1800);
      } catch (resetError) {
         setError(resetError instanceof Error ? resetError.message : 'Could not update your password. Try again in a moment.');
      } finally {
         setLoading(false);
      }
   };

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
                     <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-[26px] bg-[#F1E7FF] text-[#8336F0]">
                        <KeyRound className="h-10 w-10" strokeWidth={1.8} />
                     </div>
                     <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#8336F0]">
                        Account access
                     </p>
                     <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#040033]">
                        Reset your password
                     </h1>
                     <p className="mt-3 max-w-[340px] text-base font-medium leading-6 tracking-[-0.02em] text-[#70617F]">
                        Enter your email and Moodeng will send a reset code to set a new password.
                     </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                     <div className="space-y-2">
                        <label htmlFor="reset-email" className="text-base font-semibold tracking-[-0.02em] text-[#040033]">
                           Email address
                        </label>
                        <div className="flex h-14 items-center gap-3 rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-4 shadow-[0_2px_4px_rgba(27,28,29,0.04)] focus-within:border-[#8336F0] focus-within:ring-4 focus-within:ring-[#E9D8FF]">
                           <Mail className="h-5 w-5 shrink-0 text-[#8336F0]" strokeWidth={1.8} />
                           <input
                              id="reset-email"
                              type="email"
                              value={email}
                              onChange={(event) => {
                                 setEmail(event.target.value);
                                 setError('');
                                 setMessage('');
                                 setHasRequestedReset(false);
                              }}
                              placeholder="you@example.com"
                              autoComplete="email"
                              className="min-w-0 flex-1 bg-transparent text-base text-[#040033] outline-none placeholder:text-[#70617F]"
                              required
                           />
                        </div>
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
                     ) : null}

                     <button
                        type="submit"
                        disabled={loading || !email.trim()}
                        className="h-14 w-full rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95 disabled:bg-[#BDB5C7] disabled:text-[#FDFCFD]"
                     >
                        {loading ? 'Sending...' : hasRequestedReset ? 'Send a new code' : 'Send reset code'}
                     </button>
                  </form>

                  {hasRequestedReset ? (
                     <form onSubmit={handleCodeReset} className="mt-5 space-y-5 rounded-3xl border border-[#E7D8FF] bg-[#F8F4FC] p-4">
                        <div className="space-y-2">
                           <label htmlFor="reset-code" className="text-base font-semibold tracking-[-0.02em] text-[#040033]">
                              Reset code
                           </label>
                           <input
                              id="reset-code"
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              value={code}
                              onChange={(event) => {
                                 setCode(normalizeCode(event.target.value));
                                 setError('');
                              }}
                              placeholder="000000"
                              className="h-16 w-full rounded-2xl border border-[#B5ACBE] bg-[#FDFCFD] px-5 text-center text-[30px] font-semibold tracking-[0.18em] text-[#040033] shadow-[0_2px_4px_rgba(27,28,29,0.04)] outline-none placeholder:text-[#A99CB4] focus:border-[#8336F0] focus:ring-4 focus:ring-[#E9D8FF]"
                           />
                        </div>

                        <div className="space-y-2">
                           <label htmlFor="new-password" className="text-base font-semibold tracking-[-0.02em] text-[#040033]">
                              New password
                           </label>
                           <input
                              id="new-password"
                              type="password"
                              value={password}
                              onChange={(event) => {
                                 setPassword(event.target.value);
                                 setError('');
                              }}
                              placeholder="Enter new password"
                              autoComplete="new-password"
                              className="h-14 w-full rounded-2xl border border-[#B5ACBE] bg-[#FDFCFD] px-4 text-base text-[#040033] shadow-[0_2px_4px_rgba(27,28,29,0.04)] outline-none placeholder:text-[#70617F] focus:border-[#8336F0] focus:ring-4 focus:ring-[#E9D8FF]"
                           />
                        </div>

                        <div className="space-y-2">
                           <label htmlFor="confirm-new-password" className="text-base font-semibold tracking-[-0.02em] text-[#040033]">
                              Confirm password
                           </label>
                           <input
                              id="confirm-new-password"
                              type="password"
                              value={confirmPassword}
                              onChange={(event) => {
                                 setConfirmPassword(event.target.value);
                                 setError('');
                              }}
                              placeholder="Re-enter new password"
                              autoComplete="new-password"
                              className="h-14 w-full rounded-2xl border border-[#B5ACBE] bg-[#FDFCFD] px-4 text-base text-[#040033] shadow-[0_2px_4px_rgba(27,28,29,0.04)] outline-none placeholder:text-[#70617F] focus:border-[#8336F0] focus:ring-4 focus:ring-[#E9D8FF]"
                           />
                        </div>

                        <button
                           type="submit"
                           disabled={loading || code.length !== 6 || password.length < 6 || !confirmPassword}
                           className="h-14 w-full rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95 disabled:bg-[#BDB5C7] disabled:text-[#FDFCFD]"
                        >
                           {loading ? 'Updating...' : 'Change password'}
                        </button>
                     </form>
                  ) : null}

                  <Link
                     to="/sign-in"
                     className="mt-5 flex h-12 items-center justify-center rounded-2xl border border-[#E0D7E8] text-sm font-semibold text-[#4D4359] transition hover:bg-[#F8F4FC]"
                  >
                     Back to sign in
                  </Link>
               </section>
            </main>
         </div>
      </div>
   );
}
