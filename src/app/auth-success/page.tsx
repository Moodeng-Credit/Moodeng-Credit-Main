import type { JSX } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, HelpCircle } from 'lucide-react';

import { AuthFooter } from '@/components/auth/AuthFooter';
import { Icons } from '@/views/login/components/Icons';

function AccountCreatedView(): JSX.Element {
   const navigate = useNavigate();

   return (
      <div className="relative isolate flex min-h-dvh flex-col bg-gradient-to-b from-[#FBFAFD] to-[#FFFFFF] font-sans">
         <Link
            to="/faq"
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#8336F0] text-[#8336F0] hover:bg-[rgba(105,17,229,0.08)]"
            aria-label="Help"
         >
            <HelpCircle className="h-5 w-5" />
         </Link>
         <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-10">
            <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
               <img src="/confirm-image.png" alt="" className="mb-6 h-32 w-auto object-contain sm:h-40" />
               <h1 className="mb-3 text-[28px] font-[590] leading-[1.2] tracking-[-0.04em] text-[#040033] sm:text-[34px]">
                  Your account has been created
               </h1>
               <p className="mb-8 text-base font-[510] leading-6 tracking-[-0.02em] text-[#6D6D6D]">
                  Your wallet is used to build your Trust Score and receive USDC loans.
               </p>
               <button
                  type="button"
                  onClick={() => navigate('/onboarding/role', { replace: true })}
                  className="flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-[#6010D2] px-6 py-4 text-base font-[590] tracking-[-0.02em] text-[#FDFCFD] transition-opacity hover:opacity-95"
               >
                  Proceed
                  <ChevronRight className="h-5 w-5" />
               </button>
            </div>
         </div>
         <div className="shrink-0 px-5 pb-10">
            <div className="mx-auto w-full max-w-sm">
               <AuthFooter />
            </div>
         </div>
      </div>
   );
}

function VerifyEmailView({ variant }: { variant: 'verify' | 'link' }): JSX.Element {
   const isLinkFlow = variant === 'link';

   return (
      <div className="relative isolate flex min-h-dvh flex-col bg-gradient-to-b from-[#FBFAFD] to-[#FFFFFF] font-sans">
         <Link
            to="/faq"
            className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#8336F0] text-[#8336F0] hover:bg-[rgba(105,17,229,0.08)]"
            aria-label="Help"
         >
            <HelpCircle className="h-5 w-5" />
         </Link>

         <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-10">
            <div className="mx-auto flex w-full max-w-md flex-col items-center overflow-y-auto text-center">
               <img src="/onboarding-image.png" alt="" className="mb-6 h-28 w-auto object-contain sm:h-36" />

               <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(105,17,229,0.12)] text-[#6010D2]">
                  <Icons.email className="h-8 w-8" />
               </div>

               <h1 className="mb-3 text-[28px] font-[590] leading-[1.2] tracking-[-0.04em] text-[#040033] sm:text-[32px]">
                  {isLinkFlow ? 'Check your email' : 'Verify your email'}
               </h1>
               <p className="mb-8 text-base font-[510] leading-6 tracking-[-0.02em] text-[#6D6D6D]">
                  {isLinkFlow
                     ? 'We sent a link to set your password so you can sign in with email. After you confirm, you can finish onboarding in the app.'
                     : 'We sent a verification link to your inbox. Click it to activate your account — then sign in to pick your role and continue.'}
               </p>

               <Link
                  to="/login#login"
                  className="mb-4 flex w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-[#6010D2] px-6 py-4 text-base font-[590] tracking-[-0.02em] text-[#FDFCFD] transition-opacity hover:opacity-95"
               >
                  Back to Sign In
                  <ChevronRight className="h-5 w-5" />
               </Link>

               <p className="text-sm text-[#6D6D6D]">
                  Didn&apos;t get it? Check spam or request a new link from Sign In.
               </p>
            </div>
         </div>

         <div className="shrink-0 px-5 pb-10">
            <div className="mx-auto w-full max-w-sm">
               <AuthFooter />
            </div>
         </div>
      </div>
   );
}

export default function AuthSuccessPage(): JSX.Element {
   const [searchParams] = useSearchParams();
   const type = searchParams.get('type');
   const isLinkFlow = type === 'link';
   const isCreatedFlow = type === 'created';

   if (isCreatedFlow) {
      return <AccountCreatedView />;
   }

   return <VerifyEmailView variant={isLinkFlow ? 'link' : 'verify'} />;
}
