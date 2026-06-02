import type { JSX } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import AuthCard from '@/views/login/components/AuthCard';
import { Icons } from '@/views/login/components/Icons';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

function AccountCreatedView(): JSX.Element {
   const navigate = useNavigate();

   return (
      <div className="min-h-screen bg-white flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader hideBack />
         <div className="flex flex-col flex-1 items-center justify-center px-md-5 pb-md-5 gap-md-5">
            <img src="/confirm-image.png" alt="" className="w-52 h-52 object-contain" />
            <div className="flex flex-col items-center text-center gap-md-2">
               <h1 className="text-[34px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">Your account has been created</h1>
               <p className="text-md-b1 text-md-neutral-700 tracking-[-0.02em]">
                  Your wallet is used to build your Trust Score and receive USDC loans.
               </p>
            </div>
            <button
               type="button"
               onClick={() => navigate('/onboarding/role', { replace: true })}
               className="flex items-center justify-center gap-2 w-full py-4 px-5 rounded-md-lg font-semibold text-md-b1 text-md-neutral-100 tracking-[-0.02em] bg-md-primary-1200 transition-opacity"
            >
               Proceed
            </button>
         </div>
      </div>
   );
}

export default function AuthSuccessPage(): JSX.Element {
   const [searchParams] = useSearchParams();
   const type = searchParams.get('type');
   const isLinkFlow = type === 'link';
   const isCreatedFlow = type === 'created';
   const isConfirmedFlow = type === 'confirmed';

   if (isCreatedFlow) {
      return <AccountCreatedView />;
   }

   return (
      <div
         className="flex overflow-hidden flex-col items-center px-6 py-12 w-full min-h-screen max-md:px-4 bg-gray-100"
         style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 0)`,
            backgroundSize: '20px 20px'
         }}
      >
         <div className="flex justify-center items-center w-full max-w-md">
            <AuthCard title="Check Your Email" isSignUp={false} headerColor="bg-emerald-500" mascotPosition="right">
               <div className="flex flex-col items-center text-center space-y-6 py-4">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                     <Icons.email className="w-10 h-10" />
                  </div>

                  <div className="space-y-2">
                     <h2 className="text-2xl font-bold text-gray-800">
                        {isLinkFlow ? 'Link Your Account' : isConfirmedFlow ? 'Email Confirmed' : 'Verify Your Email'}
                     </h2>
                     <p className="text-gray-600 leading-relaxed">
                        {isLinkFlow
                           ? "An account with this email already exists (likely via Google). We've sent a password reset link to your email. Please use it to set a password and link your email login."
                           : isConfirmedFlow
                             ? 'Your email link was accepted. Sign in to continue if Moodeng did not open your account automatically.'
                             : "We've sent a verification email. Click the link or enter the code to finish creating your account."}
                     </p>
                  </div>

                  <div className="w-full pt-4">
                     {!isLinkFlow && !isConfirmedFlow && (
                        <Link
                           to="/auth/verify-code"
                           className="mb-3 flex justify-center items-center px-6 py-3 w-full text-[#6010D2] font-bold bg-[#F2EAFE] rounded-xl hover:bg-[#E9D8FF] transition-colors"
                        >
                           Enter code
                        </Link>
                     )}
                     <Link
                        to="/sign-in#login"
                        className="flex justify-center items-center px-6 py-3 w-full text-white font-bold bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
                     >
                        {isConfirmedFlow ? 'Sign In' : 'Back to Login'}
                     </Link>
                  </div>

                  <p className="text-sm text-gray-400">Didn't receive the email? Check your spam folder or try again.</p>
               </div>
            </AuthCard>
         </div>
      </div>
   );
}
