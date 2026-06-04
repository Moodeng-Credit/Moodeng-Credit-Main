import { type MouseEvent, useCallback, useMemo, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { format, parseISO } from 'date-fns';
import { ChevronRight, ExternalLink, Send, X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import useWallet from '@/hooks/useWallet';

import { formatCurrency, formatNumber } from '@/utils/decimalHelpers';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import {
   type BorrowerContextChip,
   type BorrowerContextChipType,
   type BorrowerContextFitLevel,
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
   tourBorrowerUsername?: string;
   borrowerContextProfile?: BorrowerContextProfileData;
};

const getSafeProfileText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

const contextChipClasses: Record<BorrowerContextChipType, string> = {
   name: 'bg-[#efe7ff] text-md-primary-1200 dark:bg-[#3a2460] dark:text-[#d4b8ff]',
   pay: 'bg-[#dce9ff] text-[#1b4db8] dark:bg-[#1a2d4d] dark:text-[#93b8ff]',
   need: 'bg-[#f0e3ff] text-[#8a22df] dark:bg-[#35194d] dark:text-[#cc88ff]',
   money: 'bg-[#ccf6e4] text-[#056044] dark:bg-[#0d3326] dark:text-[#5ddba8]',
   date: 'bg-[#fff0c2] text-[#a34800] dark:bg-[#3d2800] dark:text-[#ffd166]',
   delta: 'bg-[#e9f9d4] text-[#3d6f00] dark:bg-[#1a3300] dark:text-[#a3e060]'
};

const verdictClasses: Record<BorrowerContextFitLevel, string> = {
   strong: 'bg-[#d4f8df] text-[#075e45] dark:bg-[#0d3326] dark:text-[#5ddba8]',
   ok: 'bg-[#dcf4ff] text-[#064a6a] dark:bg-[#0a2233] dark:text-[#7dd3fc]',
   weak: 'bg-[#fff0c2] text-[#6d4300] dark:bg-[#3d2800] dark:text-[#ffd166]',
   unknown: 'bg-[#f8f4ff] text-md-neutral-1000 dark:bg-[#2a2040] dark:text-md-neutral-700'
};

function BorrowerContextChipView({ chip }: { chip: BorrowerContextChip }) {
   return (
      <span
         className={`inline-flex items-center rounded-md-pill px-2 py-0.5 text-md-b2 font-semibold leading-[1.25] ${contextChipClasses[chip.type]}`}
      >
         {chip.label}
      </span>
   );
}

function BorrowerContextLine({ context }: { context: BorrowerContextResult }) {
   const chipMap = new Map(context.chips.map((chip) => [chip.id, chip]));
   const parts = context.contextLine.split(/(\{[a-z-]+\})/g);

   return (
      <p className="flex flex-wrap items-center gap-x-1 text-md-b2 font-medium leading-[1.55] text-md-neutral-900 dark:text-md-neutral-700">
         {parts.map((part, index) => {
            const chipId = part.match(/^\{([a-z-]+)\}$/)?.[1];
            const chip = chipId ? chipMap.get(chipId) : undefined;

            if (chip) {
               return <BorrowerContextChipView key={`${chip.id}-${index}`} chip={chip} />;
            }

            return <span key={`${part}-${index}`}>{part.trim()}</span>;
         })}
      </p>
   );
}

type LenderIouInfo = { loanAmount: number; borrowerFundedLoanCount: number };

function BorrowerContextPanel({ context, lenderIouInfo }: { context: BorrowerContextResult; lenderIouInfo?: LenderIouInfo }) {
   const iouLine = lenderIouInfo
      ? (() => {
           const prior = lenderIouInfo.borrowerFundedLoanCount;
           const bonus = getYearOneIouBorrowerBonusPoints(prior);
           const total = formatPointsMajor(computeYearOneIouPointsDelta(lenderIouInfo.loanAmount, prior));
           const base = formatPointsMajor(computePointsDelta(lenderIouInfo.loanAmount));
           const bonusLabel = prior === 0 ? '1st-time borrower bonus' : prior === 1 ? '2nd-loan borrower bonus' : prior === 2 ? '3rd-loan borrower bonus' : '4th+ loan borrower bonus';
           return `Fund this and earn ${total} IOU points — ${base} for the loan + ${bonus} point ${bonusLabel}.`;
        })()
      : null;

   return (
      <section className="rounded-[20px] bg-[#f3efff] dark:bg-[#1e1535] p-4">
         <p className="mb-3 text-md-b3 font-bold uppercase tracking-[0.18em] text-md-primary-900 dark:text-[#c4a0ff]">Timing Fit</p>
         <BorrowerContextLine context={context} />
         <div className={`mt-4 rounded-[18px] p-4 text-md-b2 font-medium leading-[1.55] ${verdictClasses[context.fitLevel]}`}>
            <p dangerouslySetInnerHTML={{ __html: context.verdictHTML }} />
            {iouLine ? (
               <p className="mt-3 font-semibold">{iouLine}</p>
            ) : null}
         </div>
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
   const [showModal, setShowModal] = useState(false);
   const [isProcessing, setIsProcessing] = useState(false);
   const [showDetails, setShowDetails] = useState(false);
   const { showToast, showToastByConfig } = useToast();
   const wallet = useSelector((state: RootState) => state.auth.user?.walletAddress);
   const storeUserId = useSelector((state: RootState) => state.auth.user.id);
   const userId = currentUserId || storeUserId;
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const allLoans = useSelector((state: RootState) => state.loans.loans.gloans);
   const borrowerProfile = borrowerUserId ? userProfiles[borrowerUserId] : undefined;
   const borrowerFundedLoanCount = borrowerUserId
      ? allLoans.filter((l) => l.borrowerUser === borrowerUserId && l.loanStatus === 'Lent').length
      : undefined;
   const borrowerUsername = getSafeProfileText(borrowerProfile?.username) ?? getSafeProfileText(tourBorrowerUsername) ?? '';
   const borrowerDetailsHref =
      tourBorrowerUsername && (import.meta.env.DEV || isPreviewRequest)
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

      try {
         const transactionHash = await Transfer(borrowerWallet, formatNumber(loanData.loanAmount), loanData.id, transferCoin);

         if (transactionHash) {
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

   const handleLend = async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (!isConnected) {
         openConnectModal?.();
         return;
      }
      await executeLend();
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
         ...borrowerContextProfileData
      });
   }, [borrowerContextProfileData, borrowerDisplayName, borrowerFundedLoanCount, due, loanData.createdAt, loanData.loanAmount, loanReason]);
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
            {canDeleteOwnRequest ? (
               <button
                  type="button"
                  onClick={handleDeleteOwnRequest}
                  disabled={isDeletingOwnRequest}
                  aria-label="Delete your loan request"
                  title="Delete request"
                  className="absolute right-3 top-3 z-10 inline-flex size-11 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-[0_8px_20px_rgba(185,28,28,0.12)] transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
               >
                  <X className="size-5" strokeWidth={2.5} />
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
                     {!isProcessing && <Send className="w-5 h-5" />}
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
