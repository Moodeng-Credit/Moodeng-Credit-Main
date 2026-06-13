import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { format, parseISO } from 'date-fns';
import { ChevronRight, ExternalLink, Loader2, Send, Trash2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

import FundingMethodModal, { type FundLoanTarget } from '@/components/funding/FundingMethodModal';
import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';
import LenderFundLoanModal from '@/views/lender/loanNote/LenderFundLoanModal';

import { useIsFundingAdmin } from '@/hooks/useIsFundingAdmin';
import useWallet from '@/hooks/useWallet';

import { formatCurrency, formatNumber } from '@/utils/decimalHelpers';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import {
   type BorrowerContextProfileData,
   type BorrowerContextResult,
   buildBorrowerContextFit,
   normalizeBorrowerContextProfile
} from '@/lib/borrowerContextFit';
import { fetchLoans, type LoanSideEffectError, updateLoanStatus } from '@/store/slices/loanSlice';
import { computePointsDelta, computeYearOneIouPointsDelta, formatPointsMajor, getYearOneIouBorrowerBonusPoints } from '@/shared/points';

import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';

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

function BorrowerContextPanel({ context, lenderIouInfo }: { context: BorrowerContextResult; lenderIouInfo?: LenderIouInfo }) {
   const iouData = lenderIouInfo
      ? (() => {
           const prior = lenderIouInfo.borrowerFundedLoanCount;
           const bonus = getYearOneIouBorrowerBonusPoints(prior);
           const total = formatPointsMajor(computeYearOneIouPointsDelta(lenderIouInfo.loanAmount, prior));
           const base = formatPointsMajor(computePointsDelta(lenderIouInfo.loanAmount));
           const bonusLabel = prior === 0 ? '1st-time borrower bonus'
              : prior === 1 ? '2nd-loan borrower bonus'
              : prior === 2 ? '3rd-loan borrower bonus'
              : '4th+ loan borrower bonus';
           return { total, base, bonus, bonusLabel };
        })()
      : null;

   return (
      <section className="rounded-[20px] bg-[#f3efff] dark:bg-[#1e1535] p-4">
         <p className="mb-3 text-md-b3 font-bold uppercase tracking-[0.18em] text-md-primary-900 dark:text-[#c4a0ff]">Timing Fit</p>
         <p className="text-md-b2 font-medium leading-[1.65] text-md-neutral-900 dark:text-md-neutral-200 whitespace-pre-line">
            {context.paragraphText}
         </p>
         {iouData ? <div className="mt-4 rounded-[18px] bg-gradient-to-br from-[#fef3c7] to-[#fde68a] dark:from-[#3d2a00] dark:to-[#2a1d00] p-4 flex items-start gap-3">
               <span className="text-2xl leading-none mt-0.5" aria-hidden="true">🪙</span>
               <div>
                  <p className="text-md-b3 font-semibold uppercase tracking-wide text-[#92400e] dark:text-[#fbbf24]">Reward</p>
                  <p className="text-md-b1 font-bold text-[#92400e] dark:text-[#f59e0b]">
                     TOTAL EARNED: <span className="text-[#b45309] dark:text-[#fcd34d]">{iouData.total} IOU PTS</span>
                  </p>
                  <p className="mt-0.5 text-md-b3 text-[#78350f] dark:text-[#fbbf24]">
                     Includes {iouData.base} pts for funding the loan + {iouData.bonus} for {iouData.bonusLabel}!
                  </p>
               </div>
            </div> : null}
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
   const { Transfer } = useWallet();
   const account = useAccount();
   const { isConnected } = account;
   const { openConnectModal } = useConnectModal();
   // Moodeng funding admins (George/Emma) get the internal two-option modal on "Send Your
   // Help"; everyone else falls through to the normal lend flow, byte-for-byte unchanged.
   const isFundingAdmin = useIsFundingAdmin();
   const [showFundingModal, setShowFundingModal] = useState(false);
   const [showBuyModal, setShowBuyModal] = useState(false);
   const [showModal, setShowModal] = useState(false);
   const [isProcessing, setIsProcessing] = useState(false);
   // The on-chain transfer hash, set the moment Transfer resolves. Drives the "Sending" →
   // "Confirming" copy on the in-card processing overlay and the explorer link, mirroring
   // the repay flow's pattern so lenders get the same on-chain-progress feedback.
   const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
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
   const borrowerIsVerified = borrowerProfile ? borrowerProfile.isWorldId === 'ACTIVE' : undefined;
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

   const executeLend = useCallback(async () => {
      if (isProcessing || loanData.loanStatus === 'Lent') return;

      if (loanData.borrowerUser === userId) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.LOAN_SELF_LENDING_NOT_ALLOWED));
         return;
      }

      const lenderWallet = account.address?.trim() || wallet?.trim();
      if (!lenderWallet) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WALLET_MISSING));
         return;
      }

      const borrowerWallet = loanData.borrowerWallet?.trim();
      if (!borrowerWallet) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.WALLET_MISSING));
         return;
      }

      if (account.chain?.id !== ALLOWED_CHAIN_ID) {
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return;
      }

      const transferCoin = loanData.coin?.trim() || 'USDC';
      setIsProcessing(true);
      setPendingTxHash(null);

      try {
         const transactionHash = await Transfer(borrowerWallet, formatNumber(loanData.loanAmount), loanData.id, transferCoin);

         if (transactionHash) {
            // Transfer has cleared on-chain: surface the hash so the overlay flips from
            // "Sending" to "Confirming" while the DB catches up.
            setPendingTxHash(transactionHash);

            const loanPayload = {
               id: loanData.id,
               wallet: lenderWallet,
               userId,
               loanStatus: 'Lent',
               hash: transactionHash
            };

            const updateResult = await dispatch(updateLoanStatus(loanPayload));

            if (updateLoanStatus.fulfilled.match(updateResult)) {
               const sideEffectErrors = updateResult.meta.sideEffectErrors ?? [];
               setShowModal(true);

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
            } else {
               const errorMessage = updateResult.error?.message ?? 'Unknown error';
               console.error('[CRITICAL] Lending transaction succeeded but database update failed:', errorMessage);
               showToast(TOAST_TYPES.ERROR, 'Funding Failed', `We could not update the loan in the database. Error: ${errorMessage}.`);
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
   }, [
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
      account.chain?.id,
      wallet,
      Transfer,
      dispatch,
      showToast,
      showToastByConfig
   ]);

   // Set when the lender taps "Send your help" while disconnected. Once the wallet reports
   // connected, an effect resumes the lend automatically so connecting and sending are a
   // single intent rather than two taps. A ref keeps the latest executeLend closure so the
   // resume runs against fresh state (e.g. the just-connected account).
   const pendingLendRef = useRef(false);
   const executeLendRef = useRef(executeLend);

   useEffect(() => {
      executeLendRef.current = executeLend;
   }, [executeLend]);

   useEffect(() => {
      if (isConnected && pendingLendRef.current) {
         pendingLendRef.current = false;
         void executeLendRef.current();
      }
   }, [isConnected]);

   // Runs the existing normal lend flow (used by non-admins, and by admins who pick
   // "Direct Lend" in the funding modal). Connecting resumes the lend automatically.
   const runDirectLend = useCallback(() => {
      if (!isConnected) {
         pendingLendRef.current = true;
         openConnectModal?.();
         return;
      }
      void executeLend();
   }, [isConnected, openConnectModal, executeLend]);

   const handleLend = async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      // Internal accounts get to choose Direct Lend vs Smart Contract Lend (Liquidity Relay).
      if (isFundingAdmin) {
         setShowFundingModal(true);
         return;
      }
      runDirectLend();
   };

   const loanReason = loanData.reason?.trim() ? loanData.reason.trim() : 'Unknown Reason';
   const dueFormatted = format(due, 'MMM dd yyyy');
   const isOwnLoan = loanData.borrowerUser === userId;
   const isLent = loanData.loanStatus === 'Lent';
   // A relay loan Moodeng already funded whose Loan Note a lender can still buy. These appear
   // on the request board for lenders; the card's action opens the buy popup, not normal lend.
   const isRelaySellable = Boolean(
      loanData.fundingMethod === 'smart_contract' && loanData.isSellable && isLent && !isOwnLoan && !loanData.lenderUser
   );
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
   }, [borrowerContextProfileData, borrowerDisplayName, borrowerFundedLoanCount, borrowerRepaidLoanCount, borrowerGoodStanding, borrowerIsVerified, due, loanData.createdAt, loanData.loanAmount, loanReason]);
   const explorerBaseUrl = account.chain?.blockExplorers?.default?.url;
   const explorerTxUrl = pendingTxHash && explorerBaseUrl ? `${explorerBaseUrl}/tx/${pendingTxHash}` : null;
   const isLenderCard = Boolean(isAuthenticated && !isBorrower && !isOwnLoan && !isLent && !isPreviewRequest);
   const showBorrowerContext = Boolean(borrowerContext && !isBorrower && (!isLenderCard || showDetails));
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
                     <p className="text-md-b1 font-semibold text-md-heading">{pendingTxHash ? 'Confirming on Base…' : 'Sending your help…'}</p>
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
            <div
               className={`flex gap-4 items-center ${canDeleteOwnRequest ? 'pr-10' : ''} ${isLenderCard && showDetails ? 'cursor-pointer' : ''}`}
               onClick={isLenderCard && showDetails ? () => setShowDetails(false) : undefined}
            >
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

            {isLenderCard && showDetails ? (
               <button
                  type="button"
                  onClick={() => setShowDetails(false)}
                  className="flex items-center gap-1 text-md-b3 font-medium text-md-neutral-800 hover:text-md-neutral-1200 transition-colors self-start -mt-2"
               >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Back
               </button>
            ) : null}
            {showBorrowerContext && borrowerContext ? (
               <BorrowerContextPanel
                  context={borrowerContext}
                  lenderIouInfo={!isBorrower && !isOwnLoan && !isLent && (showDetails || isPreviewRequest) ? { loanAmount: loanData.loanAmount, borrowerFundedLoanCount: borrowerFundedLoanCount ?? 0 } : undefined}
               />
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
                  <Link
                     to={borrowerDetailsHref}
                     className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                  >
                     View Request
                     <ChevronRight className="w-5 h-5" />
                  </Link>
               ) : isLent ? (
                  isRelaySellable ? (
                     <button
                        type="button"
                        onClick={() => setShowBuyModal(true)}
                        className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                     >
                        Send Your Help
                        <Send className="w-5 h-5" />
                     </button>
                  ) : (
                     <div className="bg-md-neutral-500 text-md-neutral-1200 text-md-b1 font-semibold py-md-3 rounded-md-lg text-center cursor-not-allowed">
                        Help Received
                     </div>
                  )
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
                     className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                  >
                     View Request
                     <ChevronRight className="w-5 h-5" />
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
                     {!isProcessing ? <Send className="w-5 h-5" /> : null}
                  </button>
               )}

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

         {/* Buy the Loan Note (relay-sellable card on the request board) */}
         {showBuyModal ? <LenderFundLoanModal loanId={loanData.id} onClose={() => setShowBuyModal(false)} /> : null}

         {/* Fund Success Modal */}
         {showModal ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
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
            </div> : null}
      </>
   );
}
