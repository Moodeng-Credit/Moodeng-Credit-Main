import { type JSX, type ReactNode, useState } from 'react';

import { CheckCircle2, ChevronRight, HelpCircle, KeyRound } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { SetPasswordForm } from '@/components/auth/SetPasswordForm';
import { ThemeToggle } from '@/components/ThemeToggle';

import { useAuthProvider } from '@/hooks/useAuthProvider';

import { buildEmailConfirmationPath } from '@/lib/authPaths';
import { isLikelyPhilippines } from '@/lib/isLikelyPhilippines';
import { logoutUser } from '@/store/slices/authSlice';
import type { AppDispatch } from '@/store/store';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

type AuthSuccessCardProps = {
   imageSrc: string;
   imageAlt: string;
   eyebrow: string;
   title: string;
   body: ReactNode;
   children: JSX.Element;
};

function AuthSuccessShell({ imageSrc, imageAlt, eyebrow, title, body, children }: AuthSuccessCardProps): JSX.Element {
   return (
      <div className="min-h-screen bg-[#FBFAFD] dark:bg-[#100d17] px-4 py-6 sm:px-6 sm:py-10">
         <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[480px] flex-col">
            <div className="mb-5 flex justify-end gap-3">
               <ThemeToggle />
               <Link
                  to="/support/faq"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FDFCFD] dark:bg-[#1E1530] text-[#6010D2] dark:text-[#C084FC] shadow-[0_8px_24px_rgba(36,14,62,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.3)] transition hover:bg-[#F2EAFE] dark:hover:bg-[#2A1D40]"
                  aria-label="Help"
               >
                  <HelpCircle className="h-6 w-6" />
               </Link>
            </div>

            <main className="flex flex-1 flex-col justify-center">
               <section className="rounded-[28px] border border-[#E7D8FF] dark:border-white/10 bg-[#FDFCFD] dark:bg-[#1a1425] px-5 py-7 shadow-[0_18px_50px_rgba(36,14,62,0.08)] dark:shadow-[0_18px_50px_rgba(0,0,0,0.4)] sm:px-7">
                  <div className="mb-7 flex flex-col items-center text-center">
                     <div className="mb-5 flex h-[196px] w-[196px] items-center justify-center overflow-hidden rounded-[28px] border border-[#DCC7FF] dark:border-white/10 bg-white dark:bg-[#100d17] shadow-[0_12px_28px_rgba(36,14,62,0.06)]">
                        <img
                           src={imageSrc}
                           alt={imageAlt}
                           className="h-full w-full object-contain drop-shadow-[0_12px_22px_rgba(36,14,62,0.10)]"
                        />
                     </div>
                     <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#8336F0]">{eyebrow}</p>
                     <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#040033] dark:text-white">{title}</h1>
                     <div className="mt-3 max-w-[350px] text-base font-medium leading-6 tracking-[-0.02em] text-[#70617F] dark:text-[#c8b8e8]">
                        {body}
                     </div>
                  </div>

                  {children}
               </section>
            </main>
         </div>
      </div>
   );
}

/**
 * Onboarding's one password nudge: optional and skippable. Codes keep working either way, so
 * nothing waits on it (Proceed stays the main button).
 */
function OptionalPasswordCard(): JSX.Element | null {
   const { canSetPassword, hasPassword, isLoading } = useAuthProvider();
   const [isOpen, setIsOpen] = useState(false);
   const [saved, setSaved] = useState(false);

   if (isLoading || !canSetPassword || (hasPassword && !saved)) return null;

   if (saved) {
      return (
         <p className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#BCEFD0] bg-[#EDFFF4] px-4 py-3 text-sm font-semibold text-[#0D7A3C] dark:border-[#1A4A30] dark:bg-[#0F2A1E] dark:text-[#5DFFA0]">
            <CheckCircle2 className="h-4 w-4" />
            Password saved. You can still log in with a code.
         </p>
      );
   }

   return (
      <div className="w-full rounded-2xl border border-[#E7D8FF] bg-[#F8F4FC] p-4 text-left dark:border-[#2D1F4A] dark:bg-[#1E1530]">
         {isOpen ? (
            <SetPasswordForm onSaved={() => setSaved(true)} />
         ) : (
            <button type="button" onClick={() => setIsOpen(true)} className="flex w-full items-center gap-3 text-left">
               <KeyRound className="h-5 w-5 shrink-0 text-[#8336F0]" strokeWidth={1.8} />
               <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-[#040033] dark:text-white">Add a password (optional)</span>
                  <span className="block text-sm text-[#70617F] dark:text-[#c8b8e8]">You can always sign in with a code instead.</span>
               </span>
               <ChevronRight className="h-5 w-5 shrink-0 text-[#70617F]" />
            </button>
         )}
      </div>
   );
}

/**
 * Asked once, right after a code made a NEW account in a browser that looks Filipino: people who
 * borrowed before with another phone/email/Google often make a second, empty account by mistake.
 * "I've used Moodeng before" signs this new one out and sends them to log in the old way.
 */
function ReturningUserQuestion({ onNew }: { onNew: () => void }): JSX.Element {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const [returning, setReturning] = useState(false);

   const logInWith = async (method: 'phone' | 'email' | 'google') => {
      await dispatch(logoutUser()).catch(() => undefined);
      navigate(method === 'google' ? '/sign-in' : `/sign-in?method=${method}`, { replace: true });
   };

   const choice =
      'flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold tracking-[-0.02em] transition hover:opacity-95';

   return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#FBFAFD] to-white dark:from-[#100d17] dark:to-[#100d17] max-w-[440px] mx-auto w-full">
         <OnboardingHeader hideBack />
         <main className="flex flex-1 flex-col justify-center px-5 pb-14">
            <section className="mx-auto flex w-full max-w-[400px] flex-col items-center gap-4 text-center">
               {returning ? (
                  <>
                     <h1 className="text-[30px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] dark:text-white">
                        Log in the way you did before
                     </h1>
                     <p className="text-base font-medium leading-6 text-[#6D6D6D] dark:text-[#c8b8e8]">
                        Log in with the phone, email or Google you used before. Your loans and points are there.
                     </p>
                     <button type="button" onClick={() => void logInWith('phone')} className={`${choice} bg-[#6010D2] text-white`}>
                        Log in with my phone number
                     </button>
                     <button
                        type="button"
                        onClick={() => void logInWith('email')}
                        className={`${choice} border border-[#B5ACBE] text-[#250650] dark:text-white`}
                     >
                        Log in with my email
                     </button>
                     <button
                        type="button"
                        onClick={() => void logInWith('google')}
                        className={`${choice} border border-[#B5ACBE] text-[#250650] dark:text-white`}
                     >
                        Log in with Google
                     </button>
                     <button
                        type="button"
                        onClick={onNew}
                        className="text-sm font-semibold text-[#6010D2] underline underline-offset-4 dark:text-[#C084FC]"
                     >
                        I&apos;m new after all
                     </button>
                  </>
               ) : (
                  <>
                     <h1 className="text-[30px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] dark:text-white">
                        Have you used Moodeng before?
                     </h1>
                     <button type="button" onClick={onNew} className={`${choice} bg-[#6010D2] text-white`}>
                        New to Moodeng
                     </button>
                     <button
                        type="button"
                        onClick={() => setReturning(true)}
                        className={`${choice} border border-[#B5ACBE] text-[#250650] dark:text-white`}
                     >
                        I&apos;ve used Moodeng before
                     </button>
                  </>
               )}
            </section>
         </main>
      </div>
   );
}

function AccountCreatedView(): JSX.Element {
   const navigate = useNavigate();
   const [searchParams] = useSearchParams();
   const [askReturning, setAskReturning] = useState(() => searchParams.get('new') === '1' && isLikelyPhilippines());

   const handleProceed = () => {
      navigate('/onboarding/role', { replace: true });
   };

   if (askReturning) return <ReturningUserQuestion onNew={() => setAskReturning(false)} />;

   return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#FBFAFD] to-white dark:from-[#100d17] dark:to-[#100d17] max-w-[440px] mx-auto w-full">
         <OnboardingHeader hideBack />

         <main className="flex flex-1 flex-col justify-center px-5 pb-14">
            <section className="mx-auto flex w-full max-w-[400px] flex-col items-center gap-5 text-center">
               <img src="/icons/check-3d.png" alt="" className="h-[124px] w-[124px] object-contain" />
               <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-[#040033] dark:text-white">
                  Your account has been created
               </h1>
               <p className="text-base font-medium leading-6 tracking-[-0.02em] text-[#6D6D6D] dark:text-[#c8b8e8]">
                  Your wallet is used to earn Pandesal points and receive USDC loans.
               </p>
               <button
                  type="button"
                  onClick={handleProceed}
                  className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#6010D2] px-5 text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95"
               >
                  Proceed
                  <ChevronRight className="h-5 w-5" />
               </button>
               <OptionalPasswordCard />
            </section>
         </main>
      </div>
   );
}

export default function AuthSuccessPage(): JSX.Element {
   const [searchParams] = useSearchParams();
   const type = searchParams.get('type');
   const email = searchParams.get('email')?.trim();
   const isLinkFlow = type === 'link';
   const isCreatedFlow = type === 'created';
   const isConfirmedFlow = type === 'confirmed';
   const isVerifyFlow = !isLinkFlow && !isConfirmedFlow;
   const confirmationInstructions = (
      <div className="space-y-3">
         <p>Open the latest Moodeng email.</p>
         {email ? (
            <p className="mx-auto max-w-[300px] text-sm font-semibold leading-5 tracking-[-0.01em] text-[#4D4359] dark:text-[#c8b8e8] break-words">
               Sent to {email}
            </p>
         ) : null}
         <p>
            Tap <span className="font-semibold text-[#4D4359] dark:text-[#c8b8e8]">Confirm Email</span> inside that email to finish setup.
         </p>
      </div>
   );

   if (isCreatedFlow) {
      return <AccountCreatedView />;
   }

   return (
      <AuthSuccessShell
         imageSrc={isLinkFlow ? '/hippos/hippo-friendly-lock.png' : '/hippos/hippo-purple-envelope-email.png'}
         imageAlt={isLinkFlow ? 'Moodeng holding a lock' : 'Moodeng holding an envelope'}
         eyebrow={isLinkFlow ? 'Account access' : 'Welcome to Moodeng'}
         title={isLinkFlow ? 'Check your email' : isConfirmedFlow ? 'Email confirmed' : 'Confirm your email'}
         body={
            isLinkFlow
               ? 'Enter the 8-digit code from the latest Moodeng email to set a password for this account.'
               : isConfirmedFlow
                 ? 'Your email link was accepted. Sign in to continue if Moodeng did not open your account automatically.'
                 : confirmationInstructions
         }
      >
         <div className="space-y-3">
            {isLinkFlow ? (
               <Link
                  to="/forgot-password"
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#6010D2] text-sm font-semibold text-[#FDFCFD] transition hover:opacity-95"
               >
                  Enter reset code
               </Link>
            ) : null}
            {isVerifyFlow ? (
               <Link
                  to={buildEmailConfirmationPath(email)}
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#6010D2] text-sm font-semibold text-[#FDFCFD] transition hover:opacity-95"
               >
                  Enter the code from your email
               </Link>
            ) : null}
            <Link
               to="/sign-in#login"
               className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#E0D7E8] dark:border-white/15 text-sm font-semibold text-[#4D4359] dark:text-[#c8b8e8] transition hover:bg-[#F8F4FC] dark:hover:bg-white/5"
            >
               {isConfirmedFlow ? 'Sign in' : 'Back to sign in'}
            </Link>
            <p className="flex items-start gap-3 rounded-2xl border border-[#E7D8FF] dark:border-white/10 bg-[#F8F4FC] dark:bg-white/5 px-4 py-3 text-sm font-semibold leading-5 text-[#4D4359] dark:text-[#c8b8e8]">
               <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8336F0]" />
               If the email is hard to find, check spam or promotions and open the latest Moodeng email.
            </p>
         </div>
      </AuthSuccessShell>
   );
}
