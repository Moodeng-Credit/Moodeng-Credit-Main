import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccount, useConnect } from 'wagmi';

import { useBottomNavPrimaryAction } from '@/components/BottomNavActionContext';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import { TOAST_TYPES } from '@/components/ToastSystem/types';
import UserAvatar from '@/components/UserAvatar';

import { useLoanData } from '@/hooks/useLoanData';
import useWallet from '@/hooks/useWallet';

import { parseDateSafely } from '@/utils/dateFormatters';
import { formatCurrency, formatNumber, toNumber } from '@/utils/decimalHelpers';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import {
   formatWalletAddressShort,
   getBaseAccountConnector,
   getBaseWalletLockStatus,
   isBaseWalletReadyForRepayment,
   isConnectedToLockedBaseWallet
} from '@/lib/walletProvider';
import { getUserLoans, updateLoanStatus } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';

const quickRepaymentFractions = [
   { label: '25%', value: 0.25 },
   { label: '50%', value: 0.5 },
   { label: '75%', value: 0.75 },
   { label: 'Full', value: 1 }
];

const getRemainingAmount = (loan: Loan): number => Math.max(0, toNumber(loan.totalRepaymentAmount) - toNumber(loan.repaidAmount));

const getProgressPercent = (loan: Loan): number => {
   const total = toNumber(loan.totalRepaymentAmount);
   if (total <= 0) return 0;

   return Math.min(100, Math.round((toNumber(loan.repaidAmount) / total) * 100));
};

const getPreviewProgressPercent = (loan: Loan, repaymentAmount: number): number => {
   const total = toNumber(loan.totalRepaymentAmount);
   if (total <= 0 || repaymentAmount <= 0) return getProgressPercent(loan);

   return Math.min(100, Math.round(((toNumber(loan.repaidAmount) + repaymentAmount) / total) * 100));
};

const getDueCountdownCopy = (loan: Loan): string => {
   const dueDate = parseDateSafely(loan.dueDate);
   const totalMinutes = Math.round((dueDate.getTime() - Date.now()) / (1000 * 60));

   if (totalMinutes <= 0) return 'overdue now';

   const days = Math.floor(totalMinutes / (60 * 24));
   const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
   const minutes = totalMinutes % 60;

   if (days > 0) {
      return hours > 0 ? `${days}d ${hours}h left` : `${days}d left`;
   }

   if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m left` : `${hours}h left`;
   }

   return `${minutes}m left`;
};

const getDueDateShortCopy = (loan: Loan): string =>
   parseDateSafely(loan.dueDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
   });

const getDueTimeUtcCopy = (loan: Loan): string => {
   const dueDate = parseDateSafely(loan.dueDate);
   const hours = dueDate.getUTCHours();
   const minutes = dueDate.getUTCMinutes().toString().padStart(2, '0');
   const ampm = hours >= 12 ? 'PM' : 'AM';
   const displayHours = hours % 12 || 12;

   return `${displayHours}:${minutes} ${ampm} UTC`;
};

const isLoanOverdue = (loan: Loan): boolean => parseDateSafely(loan.dueDate).getTime() <= Date.now();

const isLoanDueSoon = (loan: Loan): boolean => {
   const totalHours = (parseDateSafely(loan.dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
   return totalHours > 0 && totalHours < 24;
};

const getEstimatedTrustPoints = (loan: Loan, repaymentAmount: number): number => {
   if (repaymentAmount <= 0) return 0;

   const remainingAmount = getRemainingAmount(loan);
   if (remainingAmount <= 0) return 0;

   return Math.max(1, Math.round((Math.min(repaymentAmount, remainingAmount) / remainingAmount) * 10));
};

const createPreviewLoan = (overrides: Partial<Loan>): Loan => ({
   id: 'preview-loan-1',
   trackingId: 'PREVIEW-001',
   borrowerWallet: '0x0000000000000000000000000000000000000000',
   lenderWallet: '0x0000000000000000000000000000000000000000',
   borrowerUser: 'preview-borrower',
   lenderUser: 'preview-lender',
   loanAmount: 100,
   repaidAmount: 0,
   totalRepaymentAmount: 120,
   reason: 'Medical appointment',
   loanStatus: 'Lent',
   repaymentStatus: 'Unpaid',
   dueDate: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
   coin: 'USDC',
   hash: [],
   createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
   updatedAt: new Date().toISOString(),
   fundedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
   ...overrides
});

const previewLoans: Loan[] = [
   createPreviewLoan({
      id: 'preview-loan-1',
      trackingId: 'PREVIEW-001',
      reason: 'Medical appointment',
      loanAmount: 100,
      repaidAmount: 0,
      totalRepaymentAmount: 121,
      dueDate: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString()
   }),
   createPreviewLoan({
      id: 'preview-loan-2',
      trackingId: 'PREVIEW-002',
      reason: 'Vaccination bills',
      loanAmount: 100,
      repaidAmount: 40,
      totalRepaymentAmount: 120,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString()
   })
];

const shouldUsePreviewLoans = (search: string, pathname: string): boolean => {
   if (typeof window === 'undefined') return false;

   const isPreviewHost = ['127.0.0.1', 'localhost'].includes(window.location.hostname) || window.location.hostname.endsWith('.vercel.app');
   if (!isPreviewHost) return false;

   if (pathname === '/repay-preview') return true;

   const params = new URLSearchParams(search);
   if (params.get('previewLoans') === '1') {
      window.sessionStorage.setItem('moodeng-repay-preview-loans', '1');
      return true;
   }

   return window.sessionStorage.getItem('moodeng-repay-preview-loans') === '1';
};

export default function Repay() {
   const navigate = useNavigate();
   const location = useLocation();
   const dispatch = useDispatch<AppDispatch>();
   const { showToast, showToastByConfig } = useToast();
   const { Transfer } = useWallet();
   const account = useAccount();
   const { connect, connectors, status: connectStatus } = useConnect();

   const user = useSelector((state: RootState) => state.auth.user);
   const loans = useSelector((state: RootState) => state.loans.loans.gloans);
   const usePreviewLoans = shouldUsePreviewLoans(location.search, location.pathname);
   const repayLoans = usePreviewLoans ? previewLoans : loans;
   const { hasFetched: hasCheckedRepayLoans, isLoading: isCheckingRepayLoans } = useLoanData({
      userId: user.id,
      enabled: Boolean(user.id) && !usePreviewLoans
   });

   const activeLoans = useMemo(
      () =>
         repayLoans
            .filter((loan) => loan.loanStatus === 'Lent' && loan.repaymentStatus !== 'Paid' && getRemainingAmount(loan) > 0)
            .sort((a, b) => parseDateSafely(a.dueDate).getTime() - parseDateSafely(b.dueDate).getTime()),
      [repayLoans]
   );

   const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
   const [repaymentAmount, setRepaymentAmount] = useState('');
   const [isProcessing, setIsProcessing] = useState(false);
   const [completion, setCompletion] = useState<{ reason: string; paidAmount: number; coin: string } | null>(null);
   const [justConnected, setJustConnected] = useState(false);
   // Synchronous re-entrancy guard. `isProcessing` is React state, so on a fast double-tap
   // both calls read the stale `false` and each fires its own Transfer — opening a second
   // Base Account signing popup that errors ("Something went wrong") since the request is
   // already in flight. A ref flips immediately, so the second tap is dropped.
   const repayInFlightRef = useRef(false);

   // Surface a "wallet connected — now tap Pay Now" highlight the moment the borrower
   // finishes connecting from the repay flow, then let it fade on the next interaction.
   const wasConnectedRef = useRef(account.isConnected);
   useEffect(() => {
      if (account.isConnected && !wasConnectedRef.current) {
         setJustConnected(true);
      }
      wasConnectedRef.current = account.isConnected;
   }, [account.isConnected]);

   useEffect(() => {
      if (activeLoans.length === 0) {
         setSelectedLoanId(null);
         return;
      }

      setSelectedLoanId((currentId) => (currentId && activeLoans.some((loan) => loan.id === currentId) ? currentId : activeLoans[0].id));
   }, [activeLoans]);

   const selectedLoan = activeLoans.find((loan) => loan.id === selectedLoanId) ?? activeLoans[0];
   const selectedRemaining = selectedLoan ? getRemainingAmount(selectedLoan) : 0;
   // The remaining balance is displayed rounded to cents, so validate against the rounded
   // value. Otherwise a remaining of e.g. 0.469 shows as "$0.47" but rejects a 0.47 "Full"
   // payment as exceeding the maximum, leaving the borrower unable to clear the loan.
   const selectedRemainingRounded = Math.round(selectedRemaining * 100) / 100;
   const parsedRepaymentAmount = toNumber(repaymentAmount);
   const validPreviewPayment =
      selectedLoan && parsedRepaymentAmount > 0 ? Math.min(parsedRepaymentAmount, selectedRemainingRounded) : 0;
   const currentProgressPercent = selectedLoan ? getProgressPercent(selectedLoan) : 0;
   const hasExistingRepayment = selectedLoan ? toNumber(selectedLoan.repaidAmount) > 0 : false;
   const previewProgressPercent = selectedLoan ? getPreviewProgressPercent(selectedLoan, validPreviewPayment) : 0;
   const remainingAfterPayment = Math.max(0, selectedRemaining - validPreviewPayment);
   const estimatedTrustPoints = selectedLoan ? getEstimatedTrustPoints(selectedLoan, validPreviewPayment) : 0;
   const selectedQuickFraction =
      selectedLoan && validPreviewPayment > 0
         ? quickRepaymentFractions.find((option) => Math.abs(validPreviewPayment - selectedRemaining * option.value) < 0.01)?.value
         : null;
   const amountError =
      selectedLoan && repaymentAmount
         ? parsedRepaymentAmount <= 0
            ? 'Enter an amount greater than 0.'
            : parsedRepaymentAmount > selectedRemainingRounded
              ? `Maximum repayment is $${formatCurrency(selectedRemainingRounded)}.`
              : null
         : null;

   const paymentCtaAmount = repaymentAmount ? `$${formatCurrency(parsedRepaymentAmount)}` : 'loan';
   // Before connecting, the CTA only needs to kick off the wallet connection, so it stays
   // enabled even without an amount. Once connected, it requires a valid repayment amount.
   const isRepayDisabled =
      isProcessing ||
      connectStatus === 'pending' ||
      (account.isConnected && (!repaymentAmount || Boolean(amountError) || parsedRepaymentAmount <= 0));
   const baseWalletLock = getBaseWalletLockStatus(user);
   const baseAccountConnector = useMemo(() => getBaseAccountConnector(connectors), [connectors]);
   const isUsingLockedBaseWallet = isConnectedToLockedBaseWallet({
      connectedAddress: account.address,
      connectorId: account.connector?.id,
      connectorName: account.connector?.name,
      lockedAddress: baseWalletLock.address
   });
   const canRepayWithConnectedBaseWallet = isBaseWalletReadyForRepayment({
      connectedAddress: account.address,
      connectorId: account.connector?.id,
      connectorName: account.connector?.name,
      wallet: user
   });
   const isWorldIdVerified = user.isWorldId === 'ACTIVE';
   const hasCompletedBaseWalletSetup = baseWalletLock.isConfirmedBase;
   const emptyRepayState = !selectedLoan
      ? !isWorldIdVerified && !hasCompletedBaseWalletSetup
         ? {
              actionLabel: 'Start Setup',
              body: 'Verify World ID and add a Base Wallet before requesting loans. Repayments will show here after a lender funds your first loan.',
              onAction: () => navigate('/onboarding/welcome', { state: { returnTo: 'repay' } }),
              title: 'Finish setup to start borrowing'
           }
         : !isWorldIdVerified
           ? {
                actionLabel: 'Verify World ID',
                body: 'Your Base Wallet is added. Complete World ID before requesting loans. Repayments will show here after funding.',
                onAction: () => navigate('/verify-world-id', { state: { returnTo: 'repay' } }),
                title: 'Verify World ID to borrow'
             }
           : !hasCompletedBaseWalletSetup
             ? {
                  actionLabel: 'Add Base Wallet',
                  body: 'You are verified. Add a Base Wallet so loans and repayments can stay tied to your Moodeng account.',
                  onAction: () => navigate('/onboarding/wallet', { state: { returnTo: 'repay' } }),
                  title: 'Add Base Wallet to borrow'
               }
             : {
                  actionLabel: 'Request a loan',
                  body: 'Your repayment activity will appear here once a lender funds your first loan.',
                  onAction: () => navigate('/request-board', { state: { openLoanRequest: true } }),
                  title: 'No repayments yet'
               }
      : null;

   const handleSelectLoan = (loanId: string) => {
      setSelectedLoanId(loanId);
      setRepaymentAmount('');
      setCompletion(null);
   };

   const setQuickAmount = (fraction: number) => {
      if (!selectedLoan) return;
      setRepaymentAmount(formatCurrency(getRemainingAmount(selectedLoan) * fraction));
   };

   const handleAmountChange = (event: ChangeEvent<HTMLInputElement>) => {
      setRepaymentAmount(event.target.value);
   };

   const handleRepay = useCallback(async () => {
      if (!selectedLoan || isProcessing || repayInFlightRef.current) {
         return;
      }

      // Connecting the Base wallet is the first step of the flow: let the borrower tap
      // "Connect" before they've entered an amount, then come back and complete the repayment.
      if (!account.isConnected) {
         setCompletion(null);

         if (!baseWalletLock.hasStoredWallet) {
            navigate('/onboarding/wallet', { state: { returnTo: 'repay' } });
            return;
         }

         if (!baseAccountConnector) {
            showToast(
               TOAST_TYPES.ERROR,
               'Base Account unavailable',
               'Moodeng could not open Base Account. Refresh and try again.',
               undefined,
               undefined
            );
            return;
         }

         connect({ connector: baseAccountConnector });
         return;
      }

      if (amountError || parsedRepaymentAmount <= 0) {
         return;
      }

      if (!canRepayWithConnectedBaseWallet) {
         showToast(
            TOAST_TYPES.ERROR,
            baseWalletLock.hasStoredWallet ? 'Connect your locked Base wallet' : 'Add a Base Account',
            baseWalletLock.hasStoredWallet
               ? `Repayments must come from ${formatWalletAddressShort(baseWalletLock.address)} so your repayment history stays tied to the right wallet.`
               : 'Add a Base Account before repaying so your repayment history stays tied to the right wallet.',
            undefined,
            undefined
         );
         return;
      }

      if (!isUsingLockedBaseWallet) {
         showToast(
            TOAST_TYPES.ERROR,
            'Connect your locked Base wallet',
            `Repayments must come from ${formatWalletAddressShort(baseWalletLock.address)} so your repayment history stays tied to the right wallet.`,
            undefined,
            undefined
         );
         return;
      }

      if (account.chain?.id !== ALLOWED_CHAIN_ID) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return;
      }

      repayInFlightRef.current = true;
      setIsProcessing(true);

      try {
         // Never transfer more than is actually owed — the input is validated against the
         // rounded balance, so a "Full" payment can be a hair above the true remaining.
         // Round to USDC's 6 decimals so floating-point noise never reaches the transfer
         // as an unparseable string like "0.4699999999998".
         const remaining = getRemainingAmount(selectedLoan);
         const effectiveRepayment = Math.round(Math.min(parsedRepaymentAmount, remaining) * 1e6) / 1e6;
         const newRepaidAmount = toNumber(selectedLoan.repaidAmount) + effectiveRepayment;
         const isFullyRepaid = newRepaidAmount >= toNumber(selectedLoan.totalRepaymentAmount) - 0.005;
         const newRepaymentStatus = isFullyRepaid ? 'Paid' : 'Partial';
         const transferCoin = selectedLoan.coin?.trim() || 'USDC';
         const transactionHash = await Transfer(
            selectedLoan.lenderWallet || '',
            effectiveRepayment.toString(),
            selectedLoan.id,
            transferCoin
         );

         if (!transactionHash) {
            return;
         }

         await dispatch(
            updateLoanStatus({
               id: selectedLoan.id,
               repaidAmount: newRepaidAmount,
               repaymentStatus: newRepaymentStatus,
               hash: transactionHash
            })
         ).unwrap();
         await dispatch(getUserLoans({ userId: user.id })).unwrap();
         setRepaymentAmount('');
         setJustConnected(false);
         if (isFullyRepaid) {
            setCompletion({
               reason: selectedLoan.reason || 'your loan',
               paidAmount: toNumber(selectedLoan.totalRepaymentAmount),
               coin: transferCoin
            });
         }
         showToastByConfig('repayment_success');
      } catch (error) {
         console.error('Repayment failed:', error);
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.TRANSACTION_FAILED));
      } finally {
         setIsProcessing(false);
         repayInFlightRef.current = false;
      }
   }, [
      selectedLoan,
      isProcessing,
      amountError,
      parsedRepaymentAmount,
      account.isConnected,
      account.chain?.id,
      baseAccountConnector,
      navigate,
      baseWalletLock.address,
      baseWalletLock.hasStoredWallet,
      canRepayWithConnectedBaseWallet,
      connect,
      isUsingLockedBaseWallet,
      showToast,
      showToastByConfig,
      Transfer,
      dispatch,
      user.id
   ]);

   const handleRepayRef = useRef(handleRepay);

   useEffect(() => {
      handleRepayRef.current = handleRepay;
   }, [handleRepay]);

   const handleBottomNavRepay = useCallback(() => {
      void handleRepayRef.current();
   }, []);

   const bottomNavRepayAction = useMemo(
      () =>
         selectedLoan && !completion
            ? {
                 ariaLabel: account.isConnected ? `Pay now ${paymentCtaAmount}` : 'Connect wallet to repay',
                 disabled: isRepayDisabled,
                 icon: 'dollar-circle.svg',
                 id: 'repay-pay-now',
                 isProcessing,
                 label: connectStatus === 'pending' ? 'Connecting' : account.isConnected ? 'Pay Now' : 'Connect',
                 onClick: handleBottomNavRepay,
                 path: '/repay'
              }
            : null,
      [account.isConnected, completion, connectStatus, handleBottomNavRepay, isProcessing, isRepayDisabled, paymentCtaAmount, selectedLoan]
   );

   useBottomNavPrimaryAction(bottomNavRepayAction);

   const shouldShowLoanCheckLoading =
      !usePreviewLoans && Boolean(user.id) && activeLoans.length === 0 && (!hasCheckedRepayLoans || isCheckingRepayLoans);

   if (shouldShowLoanCheckLoading) {
      return (
         <main className="repay-page min-h-screen bg-md-neutral-200 px-5 pb-28 pt-8">
            <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4">
               <div className="h-16 rounded-md-xl bg-md-neutral-300" />
               <div className="h-44 rounded-md-xl bg-md-neutral-300" />
               <div className="h-80 rounded-md-xl bg-md-neutral-300" />
            </div>
         </main>
      );
   }

   if (completion) {
      const hasMoreLoans = activeLoans.length > 0;

      return (
         <main className="repay-page min-h-screen bg-[linear-gradient(180deg,#fbfafd_0%,#ffffff_44%,#fbfafd_100%)] px-4 pb-32 pt-5 text-md-heading sm:px-6">
            <div className="mx-auto flex w-full max-w-[470px] flex-col gap-3">
               <section className="flex flex-col items-center rounded-md-xl border border-md-neutral-300 bg-white px-6 py-10 text-center shadow-[0_10px_28px_rgba(31,28,37,0.05)]">
                  <span className="flex h-16 w-16 items-center justify-center rounded-md-pill bg-md-green-100 text-md-green-900">
                     <Check className="h-8 w-8" aria-hidden="true" />
                  </span>
                  <h1 className="mt-5 text-md-h4 font-semibold text-md-heading">Loan fully repaid</h1>
                  <p className="mt-2 max-w-[320px] text-md-b2 text-md-neutral-1200">
                     You’ve cleared <span className="font-semibold text-md-heading">{completion.reason}</span> — ${formatCurrency(completion.paidAmount)}{' '}
                     {completion.coin} paid in full. Nice work building your repayment history.
                  </p>
                  <div className="mt-7 flex w-full flex-col gap-2.5">
                     {hasMoreLoans ? (
                        <button
                           type="button"
                           onClick={() => setCompletion(null)}
                           className="inline-flex min-h-[56px] items-center justify-center rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                        >
                           Repay another loan
                        </button>
                     ) : null}
                     <button
                        type="button"
                        onClick={() => navigate('/history')}
                        className="inline-flex min-h-[56px] items-center justify-center rounded-[16px] border border-md-neutral-300 bg-white px-md-4 py-md-3 text-md-b1 font-semibold text-md-primary-1200 active:scale-[0.99]"
                     >
                        View repayment history
                     </button>
                     {!hasMoreLoans ? (
                        <button
                           type="button"
                           onClick={() => navigate('/dashboard')}
                           className="inline-flex min-h-[56px] items-center justify-center rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                        >
                           Back to dashboard
                        </button>
                     ) : null}
                  </div>
               </section>
            </div>
         </main>
      );
   }

   return (
      <main className="repay-page min-h-screen bg-[linear-gradient(180deg,#fbfafd_0%,#ffffff_44%,#fbfafd_100%)] px-4 pb-32 pt-5 text-md-heading sm:px-6">
         <div className="mx-auto flex w-full max-w-[470px] flex-col gap-3">
            <header className="flex items-start justify-between gap-4">
               <div className="flex items-start gap-3">
                  <button
                     type="button"
                     onClick={() => navigate(-1)}
                     className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md-pill bg-md-neutral-100 text-md-primary-1200 shadow-md-card transition hover:bg-md-primary-100 focus:outline-none focus:ring-2 focus:ring-md-primary-500"
                     aria-label="Go back"
                  >
                     <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </button>
                  <div>
                     <h1 className="text-md-h3 font-semibold text-md-heading">Repay</h1>
                     <p className="mt-1 text-md-b2 text-md-neutral-1200">Choose a loan, enter an amount, and confirm.</p>
                  </div>
               </div>
               <UserAvatar alt={user.displayName ?? user.username ?? 'Profile'} size={48} className="shadow-md-card" />
            </header>

            {activeLoans.length > 1 ? (
               <section aria-labelledby="loan-picker-title" className="flex flex-col gap-2">
                  <div>
                     <h2 id="loan-picker-title" className="text-md-b2 font-semibold text-md-heading">
                        Pick a loan
                     </h2>
                  </div>
                  <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                     {activeLoans.map((loan) => {
                        const isSelected = loan.id === selectedLoan?.id;

                        return (
                           <button
                              type="button"
                              key={loan.id}
                              onClick={() => handleSelectLoan(loan.id)}
                              aria-pressed={isSelected}
                              className={`min-h-[74px] w-[178px] shrink-0 rounded-md-input border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-md-primary-300 ${
                                 isSelected
                                    ? 'border-md-primary-900 bg-md-primary-100 text-md-heading'
                                    : 'border-md-neutral-300 bg-white text-md-heading shadow-md-card hover:border-md-primary-300'
                              }`}
                           >
                              <div className="flex items-start justify-between gap-2">
                                 <p className="min-w-0 truncate text-md-b2 font-semibold">{loan.reason || 'Active loan'}</p>
                                 <span
                                    className={`h-2.5 w-2.5 shrink-0 rounded-md-pill ${
                                       isSelected ? 'bg-md-primary-1100' : 'bg-md-neutral-500'
                                    }`}
                                    aria-hidden="true"
                                 />
                              </div>
                              <div className="mt-3 flex items-end justify-between gap-2">
                                 <div className="min-w-0">
                                    <p className="text-md-b3 text-md-neutral-1200">Remaining</p>
                                    <p className="text-md-b1 font-semibold text-md-heading">${formatCurrency(getRemainingAmount(loan))}</p>
                                 </div>
                                 {getProgressPercent(loan) > 0 ? (
                                    <span className="text-md-b3 font-semibold text-md-primary-1200">{getProgressPercent(loan)}% paid</span>
                                 ) : null}
                              </div>
                           </button>
                        );
                     })}
                  </div>
               </section>
            ) : null}

            {selectedLoan ? (
               <section className="rounded-md-xl border border-md-neutral-300 bg-white p-4 shadow-[0_10px_28px_rgba(31,28,37,0.05)]">
                  {!account.isConnected ? (
                     <div className="mb-3 flex items-center gap-2.5 rounded-md-input border border-md-primary-100 bg-md-primary-100/45 px-3 py-2.5">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-md-primary-1200" aria-hidden="true" />
                        <p className="text-md-b3 font-medium text-md-primary-1200">
                           First, connect your Base wallet — tap <span className="font-semibold">Connect</span> below. We’ll bring you right
                           back here to finish repaying.
                        </p>
                     </div>
                  ) : justConnected ? (
                     <div className="mb-3 flex items-center gap-2.5 rounded-md-input border border-md-green-100 bg-md-green-100/60 px-3 py-2.5">
                        <Check className="h-4 w-4 shrink-0 text-md-green-900" aria-hidden="true" />
                        <p className="text-md-b3 font-medium text-md-green-900">
                           Wallet connected. Choose an amount and tap <span className="font-semibold">Pay Now</span> to repay.
                        </p>
                     </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-4">
                     <div className="min-w-0 self-start">
                        <p className="text-md-b3 font-semibold uppercase text-md-neutral-1200">You’re paying</p>
                        <h2 className="mt-1 truncate text-md-h5 text-md-heading">{selectedLoan.reason || 'Active loan'}</h2>
                     </div>
                     {!hasExistingRepayment ? (
                        <div className="shrink-0 pr-3 text-right">
                           <p className="text-md-b3 text-md-neutral-1200">Remaining</p>
                           <p className="text-[20px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">
                              ${formatCurrency(selectedRemaining)}
                           </p>
                        </div>
                     ) : null}
                  </div>

                  <div
                     className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md-input border px-3 py-3.5 ${
                        isLoanOverdue(selectedLoan) || isLoanDueSoon(selectedLoan)
                           ? 'border-[#f4d2d2] bg-[#fff7f7]'
                           : 'border-md-neutral-300 bg-md-neutral-100'
                     }`}
                  >
                     <p className="text-md-b3 font-medium leading-5 text-md-neutral-1200">
                        {isLoanOverdue(selectedLoan) ? 'Past due' : 'Time left'}
                     </p>
                     <p className="text-right text-md-b3 font-medium leading-5 text-md-neutral-1200">Due date</p>
                     <p
                        className={`min-w-0 truncate text-[20px] font-semibold leading-6 tracking-[-0.04em] ${
                           isLoanOverdue(selectedLoan) || isLoanDueSoon(selectedLoan) ? 'text-md-red-600' : 'text-md-primary-1200'
                        }`}
                     >
                        {getDueCountdownCopy(selectedLoan)}
                     </p>
                     <div className="text-right">
                        <p className="text-md-b2 font-semibold leading-6 text-md-heading">{getDueDateShortCopy(selectedLoan)}</p>
                        <p className="text-md-b3 text-md-neutral-1200">{getDueTimeUtcCopy(selectedLoan)}</p>
                     </div>
                  </div>

                  {hasExistingRepayment ? (
                     <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-md-input bg-md-neutral-100 p-3">
                           <p className="text-md-b3 text-md-neutral-1200">Remaining</p>
                           <p className="mt-1 text-[20px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">
                              ${formatCurrency(selectedRemaining)}
                           </p>
                        </div>
                        <div className="rounded-md-input bg-md-neutral-100 p-3 text-right">
                           <p className="text-md-b3 text-md-neutral-1200">Paid so far</p>
                           <p className="mt-1 text-md-h4 font-semibold text-md-primary-1200">${formatNumber(selectedLoan.repaidAmount)}</p>
                        </div>
                     </div>
                  ) : null}

                  <div className={hasExistingRepayment ? 'mt-4' : 'mt-3'}>
                     <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-4">
                           <p className="text-md-b1 font-semibold text-md-heading">Repay amount</p>
                           <p className="mt-1 text-md-b3 text-md-neutral-1200">Select an amount or enter your own.</p>
                        </div>

                        {quickRepaymentFractions.map((option) => {
                           const isQuickSelected = selectedQuickFraction === option.value;
                           const quickAmount = selectedRemaining * option.value;

                           return (
                              <button
                                 type="button"
                                 key={option.label}
                                 onClick={() => setQuickAmount(option.value)}
                                 aria-pressed={isQuickSelected}
                                 className={`relative min-h-13 rounded-md-input border px-2 text-md-b2 font-semibold transition focus:outline-none focus:ring-2 focus:ring-md-primary-300 ${
                                    isQuickSelected
                                       ? 'border-md-primary-500 bg-md-primary-100 text-md-primary-1200'
                                       : 'border-md-primary-100 bg-md-primary-100/45 text-md-primary-1200 hover:border-md-primary-400 hover:bg-md-primary-100'
                                 }`}
                              >
                                 {isQuickSelected ? (
                                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-md-pill border border-md-primary-500 bg-white text-md-primary-1200 shadow-md-card">
                                       <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                    </span>
                                 ) : null}
                                 <span className="block">{option.label}</span>
                                 <span className="mt-0.5 block text-md-b3 font-medium text-md-neutral-1200">
                                    ${formatCurrency(quickAmount)}
                                 </span>
                              </button>
                           );
                        })}

                        <div className="col-span-4 min-w-0">
                           <label htmlFor="repayment-amount" className="sr-only">
                              Repay amount
                           </label>
                           <div className="mt-3 flex min-h-[56px] items-stretch overflow-hidden rounded-md-input border border-md-neutral-500 bg-md-neutral-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition focus-within:border-md-primary-900 focus-within:ring-2 focus-within:ring-md-primary-100">
                              <div className="flex min-w-[104px] items-center justify-center gap-2 bg-[#2775ca] px-3 text-md-b1 font-semibold text-md-neutral-50">
                                 <span
                                    className="flex h-6 w-6 items-center justify-center text-[16px] font-[800] leading-none"
                                    aria-hidden="true"
                                 >
                                    ($)
                                 </span>
                                 {selectedLoan.coin || 'USDC'}
                              </div>
                              <div className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2">
                                 <input
                                    id="repayment-amount"
                                    type="text"
                                    inputMode="decimal"
                                    value={repaymentAmount}
                                    onChange={handleAmountChange}
                                    placeholder="0.00"
                                    aria-label="Repay amount"
                                    className="w-full min-w-0 bg-transparent text-md-b1 font-normal text-md-heading outline-none placeholder:text-md-neutral-1200"
                                 />
                              </div>
                           </div>
                           {amountError ? <p className="mt-2 text-md-b3 font-semibold text-md-red-600">{amountError}</p> : null}
                        </div>
                     </div>
                  </div>

                  <div className="mt-4 rounded-md-input border border-md-primary-100 bg-md-primary-100/35 p-3">
                     <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                           <p className="text-md-b3 font-semibold text-md-heading">Repayment progress</p>
                        </div>
                        {validPreviewPayment > 0 ? (
                           <span className="inline-flex shrink-0 items-center gap-1 rounded-md-pill bg-md-green-100 px-2.5 py-1 text-md-b3 font-semibold text-md-green-900">
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />+{estimatedTrustPoints} Trust Points
                           </span>
                        ) : null}
                     </div>
                     <div className="relative mt-3 h-2.5 overflow-hidden rounded-md-pill bg-[#e3dde9]">
                        <div
                           className="absolute inset-y-0 left-0 rounded-md-pill bg-md-primary-1100 transition-[width] duration-200 ease-out"
                           style={{ width: `${currentProgressPercent}%` }}
                        />
                        {previewProgressPercent > currentProgressPercent ? (
                           <div
                              className="absolute inset-y-0 rounded-md-pill bg-md-primary-400 transition-all duration-200 ease-out"
                              style={{
                                 left: `${currentProgressPercent}%`,
                                 width: `${previewProgressPercent - currentProgressPercent}%`
                              }}
                           />
                        ) : null}
                     </div>
                     {hasExistingRepayment || validPreviewPayment > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-md-b3 text-md-neutral-1200">
                           <div className="flex flex-wrap items-center gap-2">
                              {hasExistingRepayment ? (
                                 <span className="inline-flex items-center gap-1">
                                    <span className="h-2.5 w-2.5 rounded-md-pill bg-md-primary-1100" aria-hidden="true" />
                                    {currentProgressPercent}% already paid
                                 </span>
                              ) : null}
                              {validPreviewPayment > 0 ? (
                                 <span className="inline-flex items-center gap-1">
                                    <span className="h-2.5 w-2.5 rounded-md-pill bg-md-primary-400" aria-hidden="true" />
                                    today
                                 </span>
                              ) : null}
                           </div>
                           {validPreviewPayment > 0 && remainingAfterPayment > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-md-heading">
                                 <span className="h-2.5 w-2.5 rounded-md-pill bg-[#d8d0df]" aria-hidden="true" />
                                 {`$${formatCurrency(remainingAfterPayment)} remaining after this payment`}
                              </span>
                           ) : null}
                        </div>
                     ) : null}
                  </div>
               </section>
            ) : (
               <section className="flex min-h-[430px] flex-col items-center justify-center px-6 text-center">
                  <h2 className="text-md-h5 font-semibold text-[#040033]">{emptyRepayState?.title ?? 'No repayments yet'}</h2>
                  <p className="mt-3 max-w-[320px] text-md-b2 font-medium leading-[21px] text-md-neutral-1000">
                     {emptyRepayState?.body ?? 'Your repayment activity will appear here once a lender funds your first loan.'}
                  </p>
                  {emptyRepayState?.actionLabel && emptyRepayState.onAction ? (
                     <button
                        type="button"
                        onClick={emptyRepayState.onAction}
                        className="mt-5 inline-flex min-h-[56px] items-center justify-center rounded-[16px] bg-md-primary-1200 px-md-4 py-md-3 text-md-b1 font-semibold text-md-neutral-100 active:scale-[0.99]"
                     >
                        {emptyRepayState.actionLabel}
                     </button>
                  ) : null}
               </section>
            )}
         </div>
      </main>
   );
}
