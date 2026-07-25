import { type MouseEvent, useCallback, useMemo, useRef, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight, ChevronUp, Clock, ExternalLink, Loader2, Send, Trash2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useAccount, useSwitchChain } from 'wagmi';
import { getAccount } from 'wagmi/actions';

import FundingMethodModal, { type FundLoanTarget } from '@/components/funding/FundingMethodModal';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { useIsFundingAdmin } from '@/hooks/useIsFundingAdmin';
import useWallet, { type PaymentMethod } from '@/hooks/useWallet';

import { formatCurrency, formatNumber } from '@/utils/decimalHelpers';

import { config } from '@/config/wagmiConfig';
import { clearPendingBasePayment, registerPendingBasePayment } from '@/lib/basePayReconciliation';
import {
   type BorrowerContextProfileData,
   type BorrowerContextResult,
   buildBorrowerContextFit,
   normalizeBorrowerContextProfile
} from '@/lib/borrowerContextFit';
import { formatBoardExpiryLabel, getRequestBoardExpiry, type RequestBoardExpiry } from '@/lib/borrowerCreditUsage';
import { ensureAllowedChain } from '@/lib/ensureAllowedChain';
import { isUserVerified } from '@/lib/isUserVerified';
import { computePointsDelta, computeYearOneIouPointsDelta, formatPointsMajor, getYearOneIouBorrowerBonusPoints } from '@/shared/points';
import { confirmLoanPayment, fetchLoans, type LoanSideEffectError } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';
import LendChecklistModal from '@/views/dashboard/components/LendChecklistModal';

type UserCardProps = Loan & {
   currentUserId?: string;
   isBorrower?: boolean;
   isAuthenticated?: boolean;
   isHighlighted?: boolean;
   isPreviewRequest?: boolean;
   isDeletingOwnRequest?: boolean;
   onDeleteOwnRequest?: (loan: Loan) => void;
   forceTourBorrowerLink?: boolean;
   tourBorrowerUsername?: string;
   borrowerContextProfile?: BorrowerContextProfileData;
};

const getSafeProfileText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

type LenderIouInfo = { loanAmount: number; borrowerFundedLoanCount: number };

function BorrowerContextPanel({
   context,
   lenderIouInfo,
   boardExpiry
}: {
   context: BorrowerContextResult;
   lenderIouInfo?: LenderIouInfo;
   boardExpiry?: RequestBoardExpiry | null;
}) {
   const iouData = lenderIouInfo
      ? (() => {
           const prior = lenderIouInfo.borrowerFundedLoanCount;
           const bonus = getYearOneIouBorrowerBonusPoints(prior);
           const total = formatPointsMajor(computeYearOneIouPointsDelta(lenderIouInfo.loanAmount, prior));
           const base = formatPointsMajor(computePointsDelta(lenderIouInfo.loanAmount));
           const bonusLabel =
              prior === 0
                 ? '1st-time borrower bonus'
                 : prior === 1
                   ? '2nd-loan borrower bonus'
                   : prior === 2
                     ? '3rd-loan borrower bonus'
                     : '4th+ loan borrower bonus';
           return { total, base, bonus, bonusLabel };
        })()
      : null;
   const [profileSummary = context.paragraphText, trustSummary = ''] = context.paragraphText.split(/\n+/);
   const timingChips = context.chips.filter((chip) => ['pay', 'date', 'delta'].includes(chip.type)).slice(0, 3);

   return (
      <section className="rounded-[20px] border border-[#e7d8ff] bg-[#f8f4fc] p-4 dark:border-[#3a2f58] dark:bg-[#1e1830]">
         <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[#ede2ff] text-md-primary-1200 dark:bg-[#34244d] dark:text-[#c4a0ff]">
               <Clock className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
               <p className="text-[12px] font-[590] leading-[18px] tracking-[-0.24px] text-md-primary-1200 dark:text-[#c4a0ff]">
                  Timing and borrower context
               </p>
               <p className="mt-1 text-[14px] font-normal leading-[22px] tracking-[-0.28px] text-md-heading dark:text-md-neutral-200">
                  {profileSummary}
               </p>
               {trustSummary ? (
                  <p className="mt-2 text-[13px] font-normal leading-5 text-md-neutral-1200 dark:text-md-neutral-400">{trustSummary}</p>
               ) : null}
            </div>
         </div>
         {timingChips.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
               {timingChips.map((chip) => (
                  <span
                     key={chip.id}
                     className="inline-flex min-h-7 items-center rounded-full border border-[#ded2ef] bg-white px-2.5 py-1 text-[11px] font-[590] leading-4 text-md-neutral-1400 dark:border-[#4b3e62] dark:bg-[#251c39] dark:text-md-neutral-300"
                  >
                     {chip.label}
                  </span>
               ))}
            </div>
         ) : null}
         {boardExpiry ? (
            <p className="mt-4 flex items-center gap-1.5 border-t border-[#e7d8ff] pt-3 text-[12px] font-[590] leading-[18px] text-md-primary-1200 dark:border-[#3a2f58] dark:text-[#c4a0ff]">
               <Clock className="size-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
               {formatBoardExpiryLabel(boardExpiry)}
            </p>
         ) : null}
         {iouData && (
            <div className="mt-4 flex items-start gap-3 border-t border-[#e7d8ff] pt-4 dark:border-[#3a2f58]">
               <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[#fff8e1] text-[18px] dark:bg-[#3a2d18]"
                  aria-hidden="true"
               >
                  🪙
               </span>
               <div className="min-w-0">
                  <p className="text-[12px] font-[590] leading-[18px] text-[#8a5a00] dark:text-[#f5cb69]">Lender reward</p>
                  <p className="text-[16px] font-[590] leading-6 tracking-[-0.32px] text-md-heading dark:text-md-neutral-100">
                     {iouData.total} IOU Points
                  </p>
                  <p className="mt-0.5 text-[12px] font-normal leading-[18px] text-md-neutral-1200 dark:text-md-neutral-400">
                     {iouData.base} for funding, plus {iouData.bonus} for the {iouData.bonusLabel}.
                  </p>
               </div>
            </div>
         )}
      </section>
   );
}

export default function UserCard(loan: UserCardProps) {
   const {
      currentUserId,
      isBorrower = true,
      isAuthenticated = true,
      isHighlighted = false,
      isPreviewRequest = false,
      isDeletingOwnRequest = false,
      onDeleteOwnRequest,
      forceTourBorrowerLink = false,
      tourBorrowerUsername,
      borrowerContextProfile,
      ...loanData
   } = loan;
   const borrowerUserId = loanData.borrowerUser || '';

   const dispatch = useDispatch<AppDispatch>();
   const { payUsdc } = useWallet();
   const account = useAccount();
   const { isConnected } = account;
   const { switchChainAsync } = useSwitchChain();
   const { openConnectModal } = useConnectModal();
   // Moodeng funding admins (George/Emma) get the internal two-option modal on "Send Your
   // Help"; everyone else falls through to the normal lend flow, byte-for-byte unchanged.
   const isFundingAdmin = useIsFundingAdmin();
   const [showFundingModal, setShowFundingModal] = useState(false);
   const [showModal, setShowModal] = useState(false);
   const [showWalletChecklist, setShowWalletChecklist] = useState(false);
   const [isProcessing, setIsProcessing] = useState(false);
   // The on-chain transfer hash, set the moment Transfer resolves. Drives the "Sending" →
   // "Confirming" copy on the in-card processing overlay and the explorer link, mirroring
   // the repay flow's pattern so lenders get the same on-chain-progress feedback.
   const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
   // Set when the lender taps "Cancel" on the pre-broadcast overlay. The in-flight payUsdc
   // promise can't be aborted, so this lets executeLend bail out of the success UI if it
   // resolves after the user has already backed out. (A broadcast that still lands is left
   // to the reconciler — the money moved, so we never silently drop it.)
   const cancelledRef = useRef(false);
   const [showDetails, setShowDetails] = useState(false);
   const { showToast, showToastByConfig } = useToast();
   const wallet = useSelector((state: RootState) => state.auth.user?.walletAddress);
   const storeUserId = useSelector((state: RootState) => state.auth.user.id);
   const userId = currentUserId || storeUserId;
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const allLoans = useSelector((state: RootState) => state.loans.loans.floans);
   const borrowerProfile = borrowerUserId ? userProfiles[borrowerUserId] : undefined;
   const borrowerFundedLoanCount = borrowerUserId
      ? allLoans.filter((l) => l.borrowerUser === borrowerUserId && l.loanStatus === 'Lent').length
      : undefined;
   const borrowerRepaidLoanCount = borrowerUserId
      ? allLoans.filter((l) => l.borrowerUser === borrowerUserId && l.repaymentStatus === 'Paid').length
      : undefined;
   const borrowerGoodStanding = borrowerProfile ? (borrowerProfile.cs ?? 0) > 0 : undefined;
   const borrowerIsVerified = borrowerProfile ? isUserVerified(borrowerProfile) : undefined;
   const borrowerUsername = getSafeProfileText(borrowerProfile?.username) ?? getSafeProfileText(tourBorrowerUsername) ?? '';
   const borrowerDetailsHref =
      tourBorrowerUsername && (import.meta.env.DEV || isPreviewRequest || forceTourBorrowerLink)
         ? `/user/${borrowerUsername}?demo=rich&lenderTourPreview=1&tourPreview=1`
         : `/user/${borrowerUsername}`;
   const borrowerDisplayName = getSafeProfileText(borrowerProfile?.displayName) || borrowerUsername || 'Unknown user';
   const due = parseISO(loanData.dueDate);

   const handleFetch = async () => {
      setShowModal(false);
      await dispatch(fetchLoans())
         .unwrap()
         .then(() => console.log('Loan fetched successfully'))
         .catch((error: Error) => console.error('Error fetching loan:', error.message || error));
   };

   // Lets a lender back out of the "Approve in your wallet" overlay (e.g. they closed the
   // Base popup) instead of being stranded on the spinner. Only wired to the pre-broadcast
   // phase; the underlying wallet promise can't be aborted, so cancelledRef guards the
   // success UI if it resolves late, and any payment that did broadcast is left to the reconciler.
   const handleCancelProcessing = () => {
      cancelledRef.current = true;
      setIsProcessing(false);
      setPendingTxHash(null);
   };

   const executeLend = useCallback(
      async (method: PaymentMethod) => {
         if (isProcessing || loanData.loanStatus === 'Lent') return;

         if (loanData.borrowerUser === userId) {
            showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_SELF_LENDING_NOT_ALLOWED));
            return;
         }

         const borrowerWallet = loanData.borrowerWallet?.trim();
         if (!borrowerWallet) {
            showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WALLET_MISSING));
            return;
         }

         // The wagmi path sends from the already-connected wallet, so it needs a wallet and must
         // be on Base first. Base Pay needs neither: it brings its own Base Account and switches
         // the chain inside its single popup, so the pre-checks below don't apply to it.
         const liveAccount = getAccount(config);
         if (method === 'wallet') {
            const connectedWallet = liveAccount.address?.trim() || account.address?.trim() || wallet?.trim();
            if (!connectedWallet) {
               showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WALLET_MISSING));
               return;
            }
            if (!(await ensureAllowedChain(liveAccount.chainId ?? account.chainId, switchChainAsync))) {
               showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
               return;
            }
         }

         const transferCoin = loanData.coin?.trim() || 'USDC';
         cancelledRef.current = false;
         setIsProcessing(true);
         setPendingTxHash(null);

         try {
            const outcome = await payUsdc({
               method,
               to: borrowerWallet,
               usdAmount: formatNumber(loanData.loanAmount),
               loanId: loanData.id,
               coin: transferCoin,
               // Fired the instant Base Pay is approved (before confirmation): flip the overlay to
               // "Confirming" and arm reconciliation so an approved-but-unconfirmed fund still gets
               // marked Lent later instead of stranding the money.
               onSubmitted: (id) => {
                  setPendingTxHash(id);
                  registerPendingBasePayment({ kind: 'fund', id, loanId: loanData.id, userId });
               }
            });

            if (outcome) {
               // Surface the hash so the overlay flips from "Sending" to "Confirming".
               setPendingTxHash(outcome.hash);

               // The wagmi path has no onSubmitted: the money is in flight from here, so arm
               // reconciliation now — a DB confirm that fails below gets retried instead of
               // stranding a funded loan that still reads Requested.
               if (method === 'wallet') {
                  registerPendingBasePayment({ kind: 'fund', id: outcome.hash, loanId: loanData.id, userId, method });
               }

               // Server verifies the on-chain transfer before marking the loan Lent; it derives the
               // lender wallet from the actual payer and the lender id from the authenticated caller,
               // so we no longer send those from the client.
               const updateResult = await dispatch(
                  confirmLoanPayment({
                     loanId: loanData.id,
                     hash: outcome.hash,
                     method,
                     action: 'fund'
                  })
               );

               if (confirmLoanPayment.fulfilled.match(updateResult)) {
                  // DB write landed — the reconciler has nothing left to finish for this payment.
                  clearPendingBasePayment(outcome.hash);
                  const sideEffectErrors = updateResult.meta.sideEffectErrors ?? [];
                  // If they cancelled the overlay and moved on, don't slam a full-screen success
                  // modal over the request board — the toast below still confirms it went through.
                  if (!cancelledRef.current) setShowModal(true);

                  if (sideEffectErrors.length === 0) {
                     showToast(
                        TOAST_TYPES.SUCCESS,
                        'Thank You!',
                        `You successfully funded $${formatCurrency(loanData.loanAmount)} to ${borrowerDisplayName}.`
                     );
                  } else {
                     const errorDetails = sideEffectErrors
                        .map((error: LoanSideEffectError) =>
                           error.type === 'award_points'
                              ? `awarding points failed (${error.message})`
                              : `sending funded notification failed (${error.message})`
                        )
                        .join('; ');

                     showToast(
                        TOAST_TYPES.WARNING,
                        'Funded with Warnings',
                        `Loan funded successfully, but some follow-ups failed: ${errorDetails}.`
                     );
                  }
               } else if (updateResult.error?.name === 'PaymentNotConfirmedError') {
                  // Payment sent but not yet confirmed on-chain — the reconciler (armed in
                  // onSubmitted) finishes the DB write once it settles. Not a failure.
                  showToast(
                     TOAST_TYPES.INFO,
                     'Still confirming',
                     'Your payment was sent and is taking a moment to confirm. This will update automatically.'
                  );
               } else {
                  const errorMessage = updateResult.error?.message ?? 'Unknown error';
                  console.error('[CRITICAL] Lending transaction succeeded but database update failed:', errorMessage);
                  // The payment itself went through; the pending entry registered above keeps
                  // retrying the DB write, so don't tell the lender their funding "failed".
                  showToast(
                     TOAST_TYPES.WARNING,
                     'Payment Sent, Still Recording',
                     `Your payment went through but we could not record the loan yet (${errorMessage}). We will keep retrying automatically — contact support if it doesn't update.`
                  );
               }
            }
         } catch (transferError: unknown) {
            const errorMessage = transferError instanceof Error ? transferError.message : 'Unknown error';
            console.error('Transfer failed:', errorMessage);
            showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.TRANSACTION_FAILED));
         } finally {
            setIsProcessing(false);
            setPendingTxHash(null);
         }
      },
      [
         isProcessing,
         loanData.loanStatus,
         loanData.borrowerUser,
         loanData.borrowerWallet,
         loanData.coin,
         loanData.loanAmount,
         loanData.id,
         borrowerDisplayName,
         userId,
         account.address,
         account.chainId,
         switchChainAsync,
         wallet,
         payUsdc,
         dispatch,
         showToast,
         showToastByConfig
      ]
   );

   // Runs the normal lend flow (used by non-admins, and by admins who pick "Direct Lend" in
   // the funding modal). Already connected a wallet → pay straight from it (one signature
   // popup, no connect step). Not connected → Base Pay: a single popup that fuses Base Account
   // sign-in and the USDC send, so even a cold lender funds in one tap. Lenders who
   // specifically want a non-Base wallet use "Use a different wallet" below.
   const runDirectLend = useCallback(async () => {
      await executeLend(isConnected ? 'wallet' : 'base');
   }, [executeLend, isConnected]);

   const handleLend = async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      // Internal accounts get to choose Direct Lend vs Smart Contract Lend (Liquidity Relay).
      if (isFundingAdmin) {
         setShowFundingModal(true);
         return;
      }
      await runDirectLend();
   };

   // "Use a different wallet" opens a guided two-step checklist (connect → send) instead of the
   // bare connect modal. Step 2 is a real tap inside the checklist — never auto-fired on connect —
   // which is what keeps the signing popup on a live gesture (no "Try again").
   const handleConfirmFromChecklist = async () => {
      await executeLend('wallet');
      setShowWalletChecklist(false);
   };

   const loanReason = loanData.reason?.trim() ? loanData.reason.trim() : 'Unknown Reason';
   const dueFormatted = format(due, 'MMM dd yyyy');
   const isOwnLoan = loanData.borrowerUser === userId;
   const isLent = loanData.loanStatus === 'Lent';
   const canDeleteOwnRequest = Boolean(isAuthenticated && isOwnLoan && loanData.loanStatus === 'Requested' && onDeleteOwnRequest);
   const borrowerContextProfileData = useMemo(
      () => borrowerContextProfile ?? normalizeBorrowerContextProfile(borrowerProfile),
      [borrowerContextProfile, borrowerProfile]
   );
   const borrowerContext = useMemo(() => {
      if (!borrowerContextProfileData) return null;

      return buildBorrowerContextFit({
         borrowerName: borrowerDisplayName,
         requestDate: new Date(loanData.createdAt),
         dueDate: due,
         amount: loanData.loanAmount,
         reason: loanReason,
         fundedLoanCount: borrowerFundedLoanCount,
         repaidLoanCount: borrowerRepaidLoanCount,
         goodStanding: borrowerGoodStanding,
         isVerified: borrowerIsVerified,
         ...borrowerContextProfileData
      });
   }, [
      borrowerContextProfileData,
      borrowerDisplayName,
      borrowerFundedLoanCount,
      borrowerRepaidLoanCount,
      borrowerGoodStanding,
      borrowerIsVerified,
      due,
      loanData.createdAt,
      loanData.loanAmount,
      loanReason
   ]);
   const boardExpiry = useMemo(
      () => getRequestBoardExpiry({ createdAt: loanData.createdAt, loanStatus: loanData.loanStatus }),
      [loanData.createdAt, loanData.loanStatus]
   );
   const explorerBaseUrl = account.chain?.blockExplorers?.default?.url;
   const explorerTxUrl = pendingTxHash && explorerBaseUrl ? `${explorerBaseUrl}/tx/${pendingTxHash}` : null;
   const isLenderCard = Boolean(isAuthenticated && !isBorrower && !isOwnLoan && !isLent);
   const showBorrowerContext = Boolean(borrowerContext && !isBorrower && (!isLenderCard || showDetails));
   const requestDetailsId = `loan-request-details-${loanData.id}`;
   const cardClassName = [
      'relative flex flex-col gap-4 rounded-[24px] border border-[#f0f0f0] bg-white p-md-4 shadow-[0px_11px_24px_0px_rgba(0,0,0,0.02)] transition-[border-color,box-shadow,transform] duration-300',
      isHighlighted ? 'request-board-focus-highlight' : ''
   ]
      .filter(Boolean)
      .join(' ');

   const handleDeleteOwnRequest = (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onDeleteOwnRequest?.(loanData);
   };

   return (
      <>
         <div
            className={cardClassName}
            data-tour-target="lender-request-card"
            data-highlighted-request={isHighlighted ? 'true' : undefined}
         >
            {isProcessing ? (
               <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-[24px] bg-white/85 px-6 text-center backdrop-blur-sm">
                  <Loader2 className="h-8 w-8 animate-spin text-md-primary-1200" aria-hidden="true" />
                  <div>
                     <p className="text-md-b1 font-semibold text-md-heading">
                        {pendingTxHash ? 'Confirming on Base…' : 'Sending your help…'}
                     </p>
                     <p className="mt-1 text-md-b3 text-md-neutral-1200">
                        {pendingTxHash ? 'Recording your funding — hang tight.' : 'Approve the transaction in your wallet.'}
                     </p>
                  </div>
                  {explorerTxUrl ? (
                     <a
                        href={explorerTxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-md-b3 font-semibold text-md-primary-1200 underline"
                     >
                        View transaction
                     </a>
                  ) : null}
                  {/* Cancel is only offered before broadcast (no hash yet). Once it's confirming
                      on-chain the money has left the wallet and can't be recalled from here. */}
                  {!pendingTxHash ? (
                     <button
                        type="button"
                        onClick={handleCancelProcessing}
                        className="mt-1 text-md-b3 font-semibold text-md-neutral-1200 underline underline-offset-2"
                     >
                        Cancel
                     </button>
                  ) : null}
               </div>
            ) : null}
            {canDeleteOwnRequest ? (
               <button
                  type="button"
                  onClick={handleDeleteOwnRequest}
                  disabled={isDeletingOwnRequest}
                  aria-label="Delete your loan request"
                  title="Delete request"
                  className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full border border-md-red-500/30 bg-md-red-500/15 text-md-red-300 shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
               >
                  <Trash2 className="size-4" strokeWidth={2} />
               </button>
            ) : null}
            {/* Top: Loan Info + Amount Card */}
            <div className={`flex gap-4 items-center ${canDeleteOwnRequest ? 'pr-10' : ''}`}>
               {/* Left: Loan Details */}
               <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <p className="text-md-h5 font-semibold text-md-heading">{loanReason}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                     <p className="text-md-b3 text-md-neutral-700">
                        <span>by </span>
                        {borrowerUsername ? (
                           isAuthenticated ? (
                              <Link to={borrowerDetailsHref} className="text-[#d0588b] underline">
                                 {borrowerDisplayName}
                              </Link>
                           ) : (
                              <span className="text-[#d0588b]">{borrowerDisplayName}</span>
                           )
                        ) : (
                           <span className="text-md-neutral-700">{borrowerDisplayName}</span>
                        )}
                     </p>
                     <span className="inline-flex items-center justify-center px-md-1 py-md-0 rounded-[30px] border border-md-green-600 bg-[rgba(0,134,36,0.05)]">
                        <span className="text-md-b4 font-semibold text-md-green-600">Good Standing</span>
                     </span>
                  </div>
                  {/* Network Badge */}
                  <img src="/icons/base-account.svg" alt="Base" className="w-6 h-6 rounded-[3.4px]" />
                  {/* Due Date */}
                  <div className="flex items-center gap-1 text-md-b2 font-semibold">
                     <span className="text-[#585858]">Due On</span>
                     <span className="text-md-red-600">{dueFormatted}</span>
                  </div>
               </div>

               {/* Right: Amount Card */}
               <div className="shrink-0 w-[134px] bg-white border border-[#f0f0f0] rounded-[12px] p-3 flex flex-col gap-5 self-stretch justify-center">
                  <div className="flex flex-col gap-1">
                     <p className="text-md-b3 font-medium text-[#585858]">Borrowing USDC</p>
                     <p className="text-[20px] leading-[1.2] tracking-[-0.04em] font-semibold text-md-heading">
                        ${formatCurrency(loanData.loanAmount)}
                     </p>
                  </div>
                  <div className="flex flex-col gap-1">
                     <p className="text-md-b3 font-medium text-[#585858]">Get back USDC</p>
                     <p className="text-[20px] leading-[1.2] tracking-[-0.04em] font-semibold text-md-green-600">
                        ${formatCurrency(loanData.totalRepaymentAmount)}
                     </p>
                  </div>
               </div>
            </div>

            {isLenderCard && showDetails && !isPreviewRequest ? (
               <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  aria-expanded="true"
                  aria-controls={requestDetailsId}
                  className="flex items-center gap-1 text-md-b3 font-medium text-md-neutral-800 hover:text-md-neutral-1200 transition-colors self-start -mt-2"
               >
                  <ChevronUp className="h-4 w-4" />
                  Hide request details
               </button>
            ) : null}
            {showBorrowerContext && borrowerContext ? (
               <div id={requestDetailsId}>
                  <BorrowerContextPanel
                     context={borrowerContext}
                     lenderIouInfo={
                        !isBorrower && !isOwnLoan && !isLent && (showDetails || isPreviewRequest)
                           ? { loanAmount: loanData.loanAmount, borrowerFundedLoanCount: borrowerFundedLoanCount ?? 0 }
                           : undefined
                     }
                     boardExpiry={!isBorrower && !isOwnLoan && !isLent && (showDetails || isPreviewRequest) ? boardExpiry : undefined}
                  />
               </div>
            ) : null}

            {/* CTA + Borrower Link */}
            <div className="flex flex-col gap-4">
               {!isAuthenticated ? (
                  <Link
                     to="/sign-in"
                     className="w-full border border-md-primary-1200 text-md-primary-1200 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:bg-md-primary-100 active:scale-[0.98] active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                  >
                     View Request
                     <ChevronRight className="w-5 h-5" />
                  </Link>
               ) : isOwnLoan ? (
                  <div className="bg-md-neutral-500 text-md-neutral-1200 text-md-b1 font-semibold py-md-3 rounded-md-lg text-center cursor-not-allowed">
                     Your Loan Request
                  </div>
               ) : isPreviewRequest ? (
                  <button
                     type="button"
                     onClick={() => setShowDetails((current) => !current)}
                     aria-expanded={showDetails}
                     aria-controls={requestDetailsId}
                     className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                  >
                     {showDetails ? 'Hide Request' : 'View Request'}
                     {showDetails ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
               ) : isLent ? (
                  <div className="bg-md-neutral-500 text-md-neutral-1200 text-md-b1 font-semibold py-md-3 rounded-md-lg text-center cursor-not-allowed">
                     Help Received
                  </div>
               ) : isBorrower ? (
                  <Link
                     to={isOwnLoan ? `/loan/${loanData.id}` : borrowerDetailsHref}
                     className="w-full border border-md-primary-1200 text-md-primary-1200 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:bg-md-primary-100 active:scale-[0.98] active:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                  >
                     View Details
                     <ExternalLink className="w-5 h-5" />
                  </Link>
               ) : isLenderCard && !showDetails ? (
                  <button
                     type="button"
                     onClick={() => setShowDetails(true)}
                     aria-expanded="false"
                     aria-controls={requestDetailsId}
                     className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                  >
                     View Request
                     <ChevronDown className="h-5 w-5" />
                  </button>
               ) : (
                  <button
                     onClick={handleLend}
                     disabled={isProcessing}
                     type="button"
                     data-tour-target="lender-send-help-button"
                     className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                  >
                     {isProcessing ? 'Processing...' : 'Send Your Help'}
                     {!isProcessing && <Send className="w-5 h-5" />}
                  </button>
               )}

               {/* Base Pay is the one-tap default; give non-Base lenders an explicit way in. */}
               {isLenderCard && showDetails && !isLent && !isOwnLoan && !isProcessing && !isConnected ? (
                  <button
                     type="button"
                     onClick={() => setShowWalletChecklist(true)}
                     className="flex items-center justify-center gap-2 text-md-b2 font-semibold text-md-neutral-800 transition-colors hover:text-md-primary-1200"
                  >
                     Use a different wallet
                  </button>
               ) : null}

               {/* View Borrower Details — hidden for logged-out users and borrowers viewing others */}
               {isAuthenticated && (!isBorrower || isOwnLoan) ? (
                  borrowerUsername ? (
                     <Link
                        to={borrowerDetailsHref}
                        data-tour-target="lender-borrower-details-link"
                        className="flex items-center justify-center gap-2 text-md-b2 font-semibold text-[#2154e8]"
                     >
                        View Borrower Details
                        <ExternalLink className="w-5 h-5" />
                     </Link>
                  ) : (
                     <span className="flex items-center justify-center gap-2 text-md-b2 font-semibold text-md-neutral-800 cursor-not-allowed">
                        View Borrower Details
                        <ExternalLink className="w-5 h-5" />
                     </span>
                  )
               ) : null}
            </div>
         </div>

         {showWalletChecklist ? (
            <LendChecklistModal
               amountLabel={`$${formatCurrency(loanData.loanAmount)}`}
               borrowerName={borrowerDisplayName}
               connected={isConnected}
               connectedAddress={account.address}
               isProcessing={isProcessing}
               onConnect={() => openConnectModal?.()}
               onConfirm={handleConfirmFromChecklist}
               onClose={() => setShowWalletChecklist(false)}
            />
         ) : null}

         {/* Internal funding fork (George/Emma only): Direct Lend vs Smart Contract Lend */}
         {showFundingModal ? (
            <FundingMethodModal
               target={
                  {
                     loanId: loanData.id,
                     borrowerWallet: loanData.borrowerWallet ?? null,
                     borrowerName: borrowerDisplayName,
                     principal: Number(loanData.loanAmount ?? 0),
                     totalOwed: Number(loanData.totalRepaymentAmount ?? 0),
                     dueDate: loanData.dueDate ?? ''
                  } satisfies FundLoanTarget
               }
               onClose={() => setShowFundingModal(false)}
               onDirectLend={runDirectLend}
               onFunded={handleFetch}
            />
         ) : null}

         {/* Fund Success Modal */}
         {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
               <div className="bg-white rounded-2xl shadow-lg max-w-sm mx-auto flex flex-col overflow-hidden" style={{ minWidth: '320px' }}>
                  <div className="bg-gradient-to-r from-[#C55FFF] to-[#7B5FFF] px-6 py-4 flex items-center justify-between">
                     <h3 className="text-white font-bold text-lg">Funded</h3>
                     <button
                        onClick={handleFetch}
                        className="bg-white rounded-md px-2 py-1 text-[#7B5FFF] font-bold text-lg leading-none transition-all duration-150 hover:brightness-95 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        type="button"
                     >
                        X
                     </button>
                  </div>
                  <div className="p-6 flex flex-col items-center gap-4">
                     <div className="w-16 h-16 rounded-full bg-md-primary-900 flex items-center justify-center">
                        <svg
                           width="32"
                           height="32"
                           viewBox="0 0 24 24"
                           fill="none"
                           stroke="white"
                           strokeWidth="3"
                           strokeLinecap="round"
                           strokeLinejoin="round"
                        >
                           <polyline points="20 6 9 17 4 12" />
                        </svg>
                     </div>
                     <p className="text-md-b1 font-semibold text-md-heading text-center">
                        You funded ${formatCurrency(loanData.loanAmount)} to {borrowerDisplayName}
                     </p>
                     <button
                        onClick={handleFetch}
                        className="w-full bg-md-primary-1200 text-white text-md-b1 font-semibold py-3 rounded-md-lg transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                        type="button"
                     >
                        Done
                     </button>
                  </div>
               </div>
            </div>
         )}
      </>
   );
}
