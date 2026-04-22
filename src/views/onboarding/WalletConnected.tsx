import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';

import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { LoanStatus } from '@/types/loanTypes';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

export default function WalletConnected() {
   const navigate = useNavigate();
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const gloans = useSelector((state: RootState) => state.loans.loans.gloans);
   const { isConnected, status } = useAccount();
   const { disconnect } = useDisconnect();
   const [loansLoading, setLoansLoading] = useState(true);

   useEffect(() => {
      if (!user?.id) {
         setLoansLoading(false);
         return;
      }
      setLoansLoading(true);
      dispatch(getUserLoans({ userId: user.id })).finally(() => setLoansLoading(false));
   }, [user?.id, dispatch]);

   if (!user?.userRole) {
      return <Navigate to="/onboarding/role" replace />;
   }

   if (!isConnected && status !== 'reconnecting') {
      return <FailureView onRetry={() => navigate('/onboarding/wallet')} />;
   }

   const hasActiveRequest = gloans.some(
      (loan) =>
         loan.borrowerUser === user.id &&
         (loan.loanStatus === LoanStatus.REQUESTED || loan.loanStatus === LoanStatus.LENT)
   );

   const handleNext = () => {
      const destination = user.userRole === 'borrower' && hasActiveRequest ? '/dashboard' : '/request-board';
      navigate(destination, { replace: true });
   };

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader hideBack />

         <div className="flex flex-col flex-1 items-center justify-center px-md-4 gap-md-4">
            <img src="/icons/check-3d.svg" alt="Success" className="size-[124px]" />
            <h2 className="text-md-display text-md-heading text-center">Wallet Connected</h2>
            <p className="text-md-b1 font-medium text-md-neutral-700 text-center">
               Your wallet is used to build your Trust Score and receive USDC loans.
            </p>
            <button
               type="button"
               onClick={handleNext}
               disabled={loansLoading}
               className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60"
            >
               {loansLoading ? 'Loading…' : 'Next'}
               {!loansLoading && (
                  <span
                     className="block size-6 bg-md-neutral-100"
                     style={{
                        WebkitMaskImage: "url('/icons/chevron-right.svg')",
                        maskImage: "url('/icons/chevron-right.svg')",
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain'
                     }}
                  />
               )}
            </button>
            <button
               type="button"
               onClick={() => {
                  disconnect();
                  navigate('/onboarding/wallet', { replace: true });
               }}
               className="text-md-b2 font-semibold text-md-neutral-1500"
            >
               Use a different wallet
            </button>
         </div>
      </div>
   );
}

function FailureView({ onRetry }: { onRetry: () => void }) {
   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader title="Connection Failed" />

         <div className="flex flex-col flex-1 items-center justify-center px-md-4 gap-md-4">
            <div className="size-16 rounded-md-xl bg-md-red-100 inline-flex items-center justify-center">
               <span
                  className="block size-10 bg-md-red-500"
                  style={{
                     WebkitMaskImage: "url('/icons/close.svg')",
                     maskImage: "url('/icons/close.svg')",
                     WebkitMaskRepeat: 'no-repeat',
                     maskRepeat: 'no-repeat',
                     WebkitMaskPosition: 'center',
                     maskPosition: 'center',
                     WebkitMaskSize: 'contain',
                     maskSize: 'contain'
                  }}
               />
            </div>
            <h2 className="text-md-display text-md-heading text-center">Wallet Not Connected</h2>
            <p className="text-md-b1 font-medium text-md-neutral-700 text-center">
               We couldn't detect a connected wallet. Please try again to continue onboarding.
            </p>
            <button
               type="button"
               onClick={onRetry}
               className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100"
            >
               Retry
            </button>
         </div>
      </div>
   );
}
