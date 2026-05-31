import { type MouseEvent, useCallback, useState } from 'react';

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
import { fetchLoans, type LoanSideEffectError, updateLoanStatus } from '@/store/slices/loanSlice';
import type { AppDispatch, RootState } from '@/store/store';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';
import type { Loan } from '@/types/loanTypes';

type BorrowerContextState = {
   incomeSetup?: string;
   paydayWindow?: string;
   cashGaps?: string[];
   note?: string;
};

type LoanWithBorrowerContext = Loan & {
   borrowerContext?: BorrowerContextState;
   borrower_context?: BorrowerContextState;
};

type UserCardProps = LoanWithBorrowerContext & {
   currentUserId?: string;
   isBorrower?: boolean;
   isAuthenticated?: boolean;
   isPreviewRequest?: boolean;
   isDeletingOwnRequest?: boolean;
   onDeleteOwnRequest?: (loan: Loan) => void;
   tourBorrowerUsername?: string;
};

const getSafeProfileText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

const incomeContextLabels: Record<string, string> = {
   full_time: 'Full-time employee',
   part_time: 'Part-time',
   contract: 'Contract / Temp',
   contract_temp: 'Contract / Temp',
   freelance: 'Freelance / Gig',
   freelance_gig: 'Freelance / Gig',
   self_employed: 'Self-employed',
   irregular: 'Irregular income',
   irregular_income: 'Irregular income'
};

const paydayContextLabels: Record<string, { label: string; range: string; start?: number; end?: number }> = {
   '1_5': { label: 'Early month', range: '1st-5th', start: 1, end: 5 },
   '10_15': { label: 'Mid-month', range: '10th-15th', start: 10, end: 15 },
   '15_20': { label: 'Late month', range: '15th-20th', start: 15, end: 20 },
   '25_30': { label: 'End of month', range: '25th-30th', start: 25, end: 30 },
   varies: { label: 'It varies', range: 'No fixed schedule' },
   it_varies: { label: 'It varies', range: 'No fixed schedule' }
};

const cashGapContextLabels: Record<string, string> = {
   bills_before_payday: 'Bills before payday',
   transport: 'Transport costs',
   work_supplies: 'Work supplies',
   family_needs: 'Family needs',
   medical: 'Medical expenses',
   emergency_costs: 'Emergency costs',
   emergency_expense: 'Emergency costs'
};

const formatContextList = (items: string[]) => {
   if (items.length <= 1) return items[0] ?? '';
   if (items.length === 2) return `${items[0]} and ${items[1]}`;
   return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
};

const demoBorrowerContext: BorrowerContextState = {
   incomeSetup: 'full_time',
   paydayWindow: '10_15',
   cashGaps: ['family_needs', 'bills_before_payday']
};

const isBorrowerContextState = (value: unknown): value is BorrowerContextState => {
   if (!value || typeof value !== 'object') return false;
   const context = value as BorrowerContextState;
   return Boolean(context.incomeSetup || context.paydayWindow || context.cashGaps?.length);
};

const getBorrowerContextForLoan = (loanData: LoanWithBorrowerContext) => {
   if (isBorrowerContextState(loanData.borrowerContext)) return loanData.borrowerContext;
   if (isBorrowerContextState(loanData.borrower_context)) return loanData.borrower_context;
   if (import.meta.env.DEV && loanData.id.startsWith('lender-tour')) return demoBorrowerContext;
   return null;
};

const getPaydayTimingCopy = (context: BorrowerContextState, loanData: LoanWithBorrowerContext) => {
   const payday = context.paydayWindow ? paydayContextLabels[context.paydayWindow] : undefined;
   if (!payday?.start || !payday.end) return 'Payday timing varies, so review the due date against the request details.';

   const requestedAt = parseISO(loanData.createdAt);
   const dueAt = parseISO(loanData.dueDate);
   const requestedDay = requestedAt.getDate();
   const dueDay = dueAt.getDate();
   const requestLabel = format(requestedAt, 'MMM d');
   const dueLabel = format(dueAt, 'MMM d');
   const requestedBeforeWindow = requestedDay < payday.start;
   const dueInsideWindow = dueDay >= payday.start && dueDay <= payday.end;
   const dueAfterWindow = dueDay > payday.end;

   if (requestedBeforeWindow && (dueInsideWindow || dueAfterWindow)) {
      return `The request was opened ${requestLabel}, before their usual ${payday.range} payday window. The due date is ${dueLabel}, after that window opens.`;
   }

   if (dueInsideWindow) return `The due date is ${dueLabel}, inside their usual ${payday.range} payday window.`;
   if (dueAfterWindow) return `The due date is ${dueLabel}, after their usual ${payday.range} payday window.`;
   return `The due date is ${dueLabel}, before their usual ${payday.range} payday window. Review timing carefully.`;
};

function BorrowerContextSignal({
   borrowerName,
   context,
   loanData,
   loanReason
}: {
   borrowerName: string;
   context: BorrowerContextState;
   loanData: LoanWithBorrowerContext;
   loanReason: string;
}) {
   const incomeLabel = context.incomeSetup ? incomeContextLabels[context.incomeSetup] : '';
   const payday = context.paydayWindow ? paydayContextLabels[context.paydayWindow] : undefined;
   const gapLabels = (context.cashGaps ?? []).map((gap) => cashGapContextLabels[gap]).filter(Boolean);
   const gapCopy = formatContextList(gapLabels.map((gap) => gap.toLowerCase())) || 'a stated cash-flow gap';
   const gapNoun = gapLabels.length === 1 ? 'pressure point' : 'pressure points';
   const incomeCopy = incomeLabel
      ? incomeLabel.toLowerCase().includes('income')
         ? incomeLabel.toLowerCase()
         : `${incomeLabel.toLowerCase()} income`
      : 'income';
   const timingCopy = getPaydayTimingCopy(context, loanData);
   const sharedContext = [
      incomeLabel ? `${incomeLabel} income` : '',
      payday ? `${payday.label} payday (${payday.range})` : '',
      gapLabels.length > 0 ? formatContextList(gapLabels) : ''
   ].filter(Boolean);

   return (
      <section className="rounded-[16px] bg-md-primary-100/70 p-md-3" aria-label="Timing fit">
         <div className="flex flex-col gap-md-1">
            <p className="text-md-b3 font-semibold uppercase tracking-[0.08em] text-md-primary-1200">Timing fit</p>
            <p className="text-md-b2 font-semibold leading-[21px] text-md-heading">
               Read {borrowerName}&rsquo;s request against their usual cash-flow pattern.
            </p>
         </div>

         <p className="mt-md-2 text-md-b2 font-medium leading-[22px] text-md-neutral-1500">
            {borrowerName} usually reports {gapCopy} as the {gapNoun}. This ${formatCurrency(loanData.loanAmount)} request is for{' '}
            {loanReason.toLowerCase()}. Their shared context lists {incomeCopy} and{' '}
            {payday ? `${payday.label.toLowerCase()} pay timing (${payday.range})` : 'payday timing'}, so the request timing can be compared
            with the repayment date. {timingCopy}
         </p>

         {sharedContext.length > 0 ? (
            <div className="mt-md-2 rounded-[12px] bg-md-neutral-100 px-md-2 py-md-1">
               <p className="text-md-b3 font-medium leading-[18px] text-md-neutral-1200">Shared context: {sharedContext.join('; ')}</p>
            </div>
         ) : null}
      </section>
   );
}

export default function UserCard(loan: UserCardProps) {
   const {
      currentUserId,
      isBorrower = true,
      isAuthenticated = true,
      isPreviewRequest = false,
      isDeletingOwnRequest = false,
      onDeleteOwnRequest,
      tourBorrowerUsername,
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
   const { showToast, showToastByConfig } = useToast();
   const wallet = useSelector((state: RootState) => state.auth.user?.walletAddress);
   const storeUserId = useSelector((state: RootState) => state.auth.user.id);
   const userId = currentUserId || storeUserId;
   const userProfiles = useSelector((state: RootState) => state.auth.userProfiles);
   const borrowerProfile = borrowerUserId ? userProfiles[borrowerUserId] : undefined;
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
   const borrowerContext = !isBorrower && isAuthenticated ? getBorrowerContextForLoan(loanData) : null;
   const shouldShowLenderContext = isAuthenticated && !isBorrower && !isOwnLoan && !isLent;

   const handleDeleteOwnRequest = (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onDeleteOwnRequest?.(loanData);
   };

   return (
      <>
         <div
            className="relative bg-white border border-[#f0f0f0] rounded-[24px] shadow-[0px_11px_24px_0px_rgba(0,0,0,0.02)] flex flex-col gap-4 p-md-4"
            data-tour-target="lender-request-card"
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

            {shouldShowLenderContext && borrowerContext ? (
               <BorrowerContextSignal
                  borrowerName={borrowerDisplayName}
                  context={borrowerContext}
                  loanData={loanData}
                  loanReason={loanReason}
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
                     to={`/loan/${loanData.id}`}
                     className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                  >
                     View Request
                     <ChevronRight className="w-5 h-5" />
                  </Link>
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

               {/* View Borrower Details — hidden for logged-out users */}
               {isAuthenticated ? (
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1f1b29]/50">
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
