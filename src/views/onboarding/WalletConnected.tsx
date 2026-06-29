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

   // The Base Account lock is borrower-only: borrowers must connect (and stay on) a single
   // Base Account so loans/repayments are tied to one wallet. Lenders are deliberately NOT
   // locked to one wallet — they can use any connector, and fraud is handled by the detection
   // layer rather than by restricting the wallet here.
   const isBorrower = user?.userRole === 'borrower';

   if (!isPreview && isBorrower && status !== 'reconnecting') {
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
               title="Confirm Saved Base Account"
               body={`Moodeng has ${formatWalletAddressShort(baseWalletLock.address)} saved for this account. Connect that Base Account, or update the saved wallet from Account Settings if this account should use a different one.`}
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
               title={baseWalletLock.hasStoredWallet ? 'Confirm Your Base Account' : 'Base Account Not Added'}
               body={
                  baseWalletLock.hasStoredWallet
                     ? `Connect ${formatWalletAddressShort(baseWalletLock.address)} with Base Account so Moodeng can confirm the saved wallet before borrowing or repayment.`
                     : "We couldn't detect a Base Account. Please connect one to continue."
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
      if (returnTo === 'account-settings') {
         navigate('/account/settings', { replace: true });
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
      if (returnTo === 'repay') {
         navigate('/repay', { replace: true });
         return;
      }
      if (returnTo === 'milestones') {
         navigate('/milestones', { replace: true });
         return;
      }
      if (returnTo === 'dashboard-credit-level') {
         navigate('/dashboard', { replace: true });
         return;
      }
      const destination = user?.userRole === 'borrower' && hasActiveRequest ? '/dashboard' : '/request-board';
      navigate(destination, { replace: true });
   };

   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col max-w-[440px] mx-auto w-full">
         <OnboardingHeader hideBack />

         <div className="flex flex-1 flex-col items-center justify-center px-md-4 text-center">
            <img src="/icons/check-3d.png" alt="Success" className="mb-md-3 size-[104px]" />
            <div className="mb-md-4 flex max-w-[360px] flex-col items-center gap-md-2">
               <h2 className="text-[32px] font-semibold leading-[1.12] text-md-heading">Wallet Connected</h2>
               <p className="max-w-[360px] text-md-b1 font-medium leading-7 text-md-neutral-700">
                  Your wallet is used to build your Trust Score and receive USDC loans.
               </p>
            </div>
            <button
               type="button"
               onClick={handleNext}
               disabled={loansLoading}
               className="flex min-h-[56px] w-full items-center justify-center gap-md-1 rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 disabled:opacity-60"
            >
               {loansLoading ? 'Loading…' : returnTo === 'loan-request' ? 'Continue Application' : 'Next'}
               {loansLoading ? null : (
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
         </div>
      </div>
   );
}

function FailureView({ title, body, onRetry }: { title: string; body: string; onRetry: () => void }) {
   return (
      <div className="min-h-screen bg-gradient-to-b from-[#fbfafd] to-white dark:from-[#08040f] dark:via-[#12091f] dark:to-[#08040f] flex flex-col max-w-[440px] mx-auto w-full">
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
