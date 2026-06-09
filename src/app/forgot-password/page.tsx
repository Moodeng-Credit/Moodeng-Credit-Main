import { type FormEvent, type JSX, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, HelpCircle, Mail } from 'lucide-react';

import { ThemeToggle } from '@/components/ThemeToggle';
import { getAuthRedirectUrl } from '@/lib/authRedirect';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';

export default function ForgotPasswordPage(): JSX.Element {
   const [email, setEmail] = useState('');
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
            redirectTo: getAuthRedirectUrl('/auth/confirm')
         });

         if (resetError) {
            setError(resetError.message || 'Could not send a reset link. Try again in a moment.');
            return;
         }

         setMessage('Check your email for the reset link. If you do not see it soon, check spam or promotions.');
         setHasRequestedReset(true);
      } catch (resetRequestError) {
         setError(resetRequestError instanceof Error ? resetRequestError.message : 'Could not send a reset link. Try again in a moment.');
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="min-h-screen bg-[#FBFAFD] px-4 py-6 text-[#040033] dark:bg-[#0D0B14] dark:text-[#F0EAFF] sm:px-6 sm:py-10">
         <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[480px] flex-col">
            <div className="mb-5 flex items-center justify-between">
               <Link
                  to="/sign-in"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDFCFD] text-[#6010D2] shadow-[0_8px_24px_rgba(36,14,62,0.08)] transition hover:bg-[#F2EAFE] dark:bg-[#1E1530] dark:text-[#C084FC] dark:hover:bg-[#2A1D40]"
                  aria-label="Back to sign in"
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
                           src="/hippos/hippo-friendly-lock.png"
                           alt="Moodeng holding a lock"
                           className="h-full w-full object-contain drop-shadow-[0_12px_22px_rgba(36,14,62,0.10)]"
                        />
                     </div>
                     <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#8336F0] dark:text-[#C084FC]">
                        Account access
                     </p>
                     <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#040033] dark:text-[#F0EAFF]">
                        Reset your password
                     </h1>
                     <p className="mt-3 max-w-[340px] text-base font-medium leading-6 tracking-[-0.02em] text-[#70617F] dark:text-[#A89BB8]">
                        Enter your email and Moodeng will send a secure reset link to set a new password.
                     </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                     <div className="space-y-2">
                        <label htmlFor="reset-email" className="text-base font-semibold tracking-[-0.02em] text-[#040033] dark:text-[#F0EAFF]">
                           Email address
                        </label>
                        <div className="flex h-14 items-center gap-3 rounded-2xl border border-[#B5ACBE] bg-[#FBFAFD] px-4 shadow-[0_2px_4px_rgba(27,28,29,0.04)] focus-within:border-[#8336F0] focus-within:ring-4 focus-within:ring-[#E9D8FF] dark:border-[#3D2D5A] dark:bg-[#1E1530] dark:focus-within:border-[#C084FC] dark:focus-within:ring-[#2D1F4A]">
                           <Mail className="h-5 w-5 shrink-0 text-[#8336F0] dark:text-[#C084FC]" strokeWidth={1.8} />
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
                              className="min-w-0 flex-1 bg-transparent text-base text-[#040033] outline-none placeholder:text-[#70617F] dark:text-[#F0EAFF] dark:placeholder:text-[#6B5880]"
                              required
                           />
                        </div>
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
                        disabled={loading || !email.trim()}
                        className="h-14 w-full rounded-2xl bg-[#6010D2] text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95 disabled:bg-[#BDB5C7] disabled:text-[#FDFCFD] dark:disabled:bg-[#2D1F4A] dark:disabled:text-[#6B5880]"
                     >
                        {loading ? 'Sending...' : hasRequestedReset ? 'Send a new link' : 'Send reset link'}
                     </button>
                  </form>

                  {hasRequestedReset ? (
                     <div className="mt-5 rounded-3xl border border-[#E7D8FF] bg-[#F8F4FC] p-4 text-sm font-semibold leading-5 text-[#4D4359] dark:border-[#2D1F4A] dark:bg-[#1E1530] dark:text-[#C4B8D8]">
                        Reset emails can land in spam or promotions. Open the latest Moodeng email and use the link inside to choose your new password.
                     </div>
                  ) : null}

                  <Link
                     to="/sign-in"
                     className="mt-5 flex h-12 items-center justify-center rounded-2xl border border-[#E0D7E8] text-sm font-semibold text-[#4D4359] transition hover:bg-[#F8F4FC] dark:border-[#2D1F4A] dark:text-[#A89BB8] dark:hover:bg-[#1E1530]"
                  >
                     Back to sign in
                  </Link>
               </section>
            </main>
         </div>
      </div>
   );
}
