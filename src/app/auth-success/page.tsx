import { type JSX, type ReactNode } from 'react';

import { CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

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
      <div className="min-h-screen bg-[#FBFAFD] px-4 py-6 text-[#040033] sm:px-6 sm:py-10">
         <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[480px] flex-col">
            <div className="mb-5 flex justify-end">
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
                     <div className="mb-5 flex h-[196px] w-[196px] items-center justify-center overflow-hidden rounded-[28px] border border-[#DCC7FF] bg-white shadow-[0_12px_28px_rgba(36,14,62,0.06)]">
                        <img
                           src={imageSrc}
                           alt={imageAlt}
                           className="h-full w-full object-contain drop-shadow-[0_12px_22px_rgba(36,14,62,0.10)]"
                        />
                     </div>
                     <p className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] text-[#8336F0]">{eyebrow}</p>
                     <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#040033]">{title}</h1>
                     <div className="mt-3 max-w-[350px] text-base font-medium leading-6 tracking-[-0.02em] text-[#70617F]">{body}</div>
                  </div>

                  {children}
               </section>
            </main>
         </div>
      </div>
   );
}

function AccountCreatedView(): JSX.Element {
   const navigate = useNavigate();

   const handleProceed = () => {
      navigate('/onboarding/role', { replace: true });
   };

   return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#FBFAFD] to-white text-[#040033] max-w-[440px] mx-auto w-full">
         <OnboardingHeader hideBack />

         <main className="flex flex-1 flex-col justify-center px-5 pb-14">
            <section className="mx-auto flex w-full max-w-[400px] flex-col items-center gap-5 text-center">
               <img src="/icons/check-3d.png" alt="" className="h-[124px] w-[124px] object-contain" />
               <h1
                  className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em]"
                  style={{ color: '#040033', WebkitTextFillColor: '#040033' }}
               >
                  Your account has been created
               </h1>
               <p className="text-base font-medium leading-6 tracking-[-0.02em] text-[#6D6D6D]">
                  Your wallet is used to build your Trust Score and receive USDC loans.
               </p>
               <button
                  type="button"
                  onClick={handleProceed}
                  className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#6010D2] px-5 text-base font-semibold tracking-[-0.02em] text-[#FDFCFD] transition hover:opacity-95"
               >
                  Proceed
                  <ChevronRight className="h-5 w-5" />
               </button>
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
   const confirmationInstructions = (
      <div className="space-y-3">
         <p>Open the latest Moodeng email.</p>
         {email ? (
            <p className="mx-auto max-w-[300px] text-sm font-semibold leading-5 tracking-[-0.01em] text-[#4D4359] break-words">
               Sent to {email}
            </p>
         ) : null}
         <p>
            Tap <span className="font-semibold text-[#4D4359]">Confirm Email</span> inside that email to finish setup.
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
               ? 'Enter the 6-digit code from the latest Moodeng email to set a password for this account.'
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
            <Link
               to="/sign-in#login"
               className="flex h-12 w-full items-center justify-center rounded-2xl border border-[#E0D7E8] text-sm font-semibold text-[#4D4359] transition hover:bg-[#F8F4FC]"
            >
               {isConfirmedFlow ? 'Sign in' : 'Back to sign in'}
            </Link>
            <p className="flex items-start gap-3 rounded-2xl border border-[#E7D8FF] bg-[#F8F4FC] px-4 py-3 text-sm font-semibold leading-5 text-[#4D4359]">
               <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8336F0]" />
               If the email is hard to find, check spam or promotions and open the latest Moodeng email.
            </p>
         </div>
      </AuthSuccessShell>
   );
}
