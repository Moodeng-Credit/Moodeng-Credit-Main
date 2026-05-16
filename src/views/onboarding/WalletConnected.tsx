import { useEffect, useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';

import {
   areWalletAddressesEqual,
   formatWalletAddressShort,
   getBaseWalletLockStatus,
   getWalletProviderFromConnector,
   isBaseWalletProvider
} from '@/lib/walletProvider';
import { getUserLoans } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { WorldId } from '@/types/authTypes';
import { LoanStatus } from '@/types/loanTypes';
import { OnboardingHeader } from '@/views/onboarding/OnboardingHeader';

export default function WalletConnected() {
   const navigate = useNavigate();
   const location = useLocation();
   const isPreview = import.meta.env.DEV && location.pathname.includes('wallet-connected-preview');
   const dispatch = useDispatch<AppDispatch>();
   const user = useSelector((state: RootState) => state.auth.user);
   const gloans = useSelector((state: RootState) => state.loans.loans.gloans);
   const { address, connector, isConnected, status } = useAccount();
   const { disconnect } = useDisconnect();
   const [loansLoading, setLoansLoading] = useState(true);
   const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
   const baseWalletLock = getBaseWalletLockStatus(user);
   const connectedProvider = getWalletProviderFromConnector({
      connectorId: connector?.id,
      connectorName: connector?.name
   });
   const isConnectedBaseAccount = isConnected && isBaseWalletProvider(connectedProvider);
   const isConnectedWrongProvider = isConnected && !isConnectedBaseAccount;
   const isConnectedWrongWallet =
      isConnectedBaseAccount && Boolean(baseWalletLock.address) && !areWalletAddressesEqual(address, baseWalletLock.address);

   useEffect(() => {
      if (!user?.id) {
         setLoansLoading(false);
         return;
      }
      setLoansLoading(true);
      dispatch(getUserLoans({ userId: user.id })).finally(() => setLoansLoading(false));
   }, [user?.id, dispatch]);

   if (!user?.userRole && !isPreview) {
      return <Navigate to="/onboarding/role" replace />;
   }

   if (!isPreview && status !== 'reconnecting') {
      if (isConnectedWrongProvider) {
         return (
            <FailureView
               title="Use Base Account"
               body="Borrowers need to connect with the Base Account option. Other wallet connectors cannot be locked for Moodeng borrowing."
               onRetry={() => navigate('/onboarding/wallet')}
            />
         );
      }

      if (isConnectedWrongWallet) {
         return (
            <FailureView
               title="Wrong Wallet Connected"
               body={`Connect ${formatWalletAddressShort(baseWalletLock.address)}. Moodeng only lets you borrow and repay with the Base wallet locked to this account.`}
               onRetry={() => {
                  disconnect();
                  navigate('/onboarding/wallet');
               }}
            />
         );
      }

      if (!baseWalletLock.isConfirmedBase && !isConnectedBaseAccount) {
         return (
            <FailureView
               title={baseWalletLock.hasStoredWallet ? 'Confirm Your Base Wallet' : 'Base Wallet Not Added'}
               body={
                  baseWalletLock.hasStoredWallet
                     ? 'This account has a saved wallet, but Moodeng still needs to confirm it is a Base Account before borrowing or repayment.'
                     : "We couldn't detect a Base wallet. Please connect a Base Account to continue."
               }
               onRetry={() => navigate('/onboarding/wallet')}
            />
         );
      }
   }

   const hasActiveRequest = gloans.some(
      (loan) => loan.borrowerUser === user.id && (loan.loanStatus === LoanStatus.REQUESTED || loan.loanStatus === LoanStatus.LENT)
   );

   const handleNext = () => {
      if (isPreview) {
         navigate('/verify-world-id-preview', { replace: true });
         return;
      }
      if (user?.userRole === 'borrower' && user.isWorldId !== WorldId.ACTIVE) {
         navigate('/verify-world-id', { replace: true, state: { returnTo } });
         return;
      }
      if (returnTo === 'loan-request') {
         navigate('/request-board', { replace: true, state: { openLoanRequest: true } });
         return;
      }
      if (returnTo === 'account-settings') {
         navigate('/account/settings', { replace: true });
         return;
      }
      if (returnTo === 'repay') {
         navigate('/repay', { replace: true });
         return;
      }
      const destination = user?.userRole === 'borrower' && hasActiveRequest ? '/dashboard' : '/request-board';
      navigate(destination, { replace: true });
   };

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader hideBack />

         <div className="flex flex-col flex-1 items-center justify-center px-md-4 gap-md-4">
            <img src="/icons/check-3d.svg" alt="Success" className="size-[124px]" />
            <h2 className="text-md-display text-md-heading text-center">Base Wallet Locked In</h2>
            <p className="text-md-b1 font-medium text-md-neutral-700 text-center">
               Lenders can fund loans to this wallet, and repayments should come from the same wallet.
            </p>
            <div className="w-full rounded-md-lg border border-md-primary-100 bg-md-primary-900/5 p-md-3">
               <p className="text-md-b2 font-semibold text-md-heading">Why this matters</p>
               <p className="mt-1 text-md-b2 font-medium text-md-neutral-1200">
                  Your Base wallet is part of your borrower record. Change it only if you need to use a different wallet going forward.
               </p>
            </div>
            <button
               type="button"
               onClick={handleNext}
               disabled={loansLoading}
               className="flex items-center justify-center gap-md-1 w-full px-md-4 py-md-3 rounded-md-lg bg-md-primary-1200 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60"
            >
               {loansLoading ? 'Loading…' : returnTo === 'loan-request' ? 'Continue Application' : 'Next'}
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
                  if (!isPreview) disconnect();
                  navigate(isPreview ? '/onboarding/wallet-preview' : '/onboarding/wallet', { replace: true });
               }}
               className="text-md-b2 font-semibold text-md-neutral-1500"
            >
               Change Base wallet
            </button>
         </div>
      </div>
   );
}

function FailureView({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
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
            <h2 className="text-md-display text-md-heading text-center">{title}</h2>
            <p className="text-md-b1 font-medium text-md-neutral-700 text-center">{body}</p>
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
