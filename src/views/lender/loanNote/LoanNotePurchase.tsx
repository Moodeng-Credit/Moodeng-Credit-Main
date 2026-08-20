import { useMemo, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Send } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from 'wagmi';

import Loading from '@/components/Loading';
import UserAvatar from '@/components/UserAvatar';

import { txExplorerUrl } from '@/config/loanFundingConfig';
import { getLoanNotePageData } from '@/lib/loanNotes/api';
import type { LoanNotePageData } from '@/lib/loanNotes/types';
import type { RootState } from '@/store/store';
import LendChecklistModal from '@/views/dashboard/components/LendChecklistModal';
import { setPendingFundLoanId } from '@/views/lender/loanNote/fundingPopup';
import { type BuyResult, useBuyLoanNote } from '@/views/lender/loanNote/useBuyLoanNote';

const usd = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
const fmtDate = (iso: string) => {
   try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
   } catch {
      return iso;
   }
};

export default function LoanNotePurchase() {
   const { loanId = '' } = useParams();
   const navigate = useNavigate();
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();
   const { buy, busy, step } = useBuyLoanNote();

   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const username = useSelector((state: RootState) => state.auth.username);
   const isLoggedIn = Boolean(userId && username);

   const [success, setSuccess] = useState<BuyResult | null>(null);
   // Buying a Loan Note is a two-call contract flow (approve + buyLoanNote) — there's no
   // Base-Pay-style single popup for it, so a lender with no wallet always needs the explicit
   // connect-then-confirm checklist, unlike the one-tap direct-lend path on the request board.
   const [showWalletChecklist, setShowWalletChecklist] = useState(false);

   const { data, isLoading, isError } = useQuery<LoanNotePageData | null>({
      queryKey: ['loan-note-page', loanId, userId ?? null, address ?? null],
      queryFn: () => getLoanNotePageData(loanId, { userId, walletAddress: address }),
      enabled: Boolean(loanId)
   });

   const borrowerName = data?.borrowerDisplayName ?? 'this borrower';

   const requireLoginThenPopup = () => {
      // Stash the loan so onboarding auto-tags them as a lender and the funding popup
      // opens for this borrower once they're onboarded (instead of the request board).
      setPendingFundLoanId(loanId);
      navigate('/sign-in');
   };

   const handleSupport = async () => {
      if (!data) return;
      if (!isLoggedIn) {
         requireLoginThenPopup();
         return;
      }
      if (!address) {
         setShowWalletChecklist(true);
         return;
      }
      const result = await buy(data);
      if (result) setSuccess(result);
   };

   const handleConfirmFromChecklist = async () => {
      if (!data) return;
      const result = await buy(data);
      if (result) setSuccess(result);
      setShowWalletChecklist(false);
   };

   const primaryLabel = useMemo(() => {
      if (step === 'checking') return 'Checking balance…';
      if (step === 'approving') return 'Approving USDC…';
      if (step === 'buying') return 'Confirming purchase…';
      if (step === 'recording') return 'Finalizing…';
      if (busy) return 'Processing…';
      if (!isLoggedIn) return `Support ${borrowerName}`;
      return `Fund ${borrowerName}’s loan`;
   }, [step, busy, isLoggedIn, borrowerName]);

   if (isLoading) return <Loading />;
   if (isError || !data) {
      return (
         <div className="min-h-screen bg-md-neutral-200">
            <div className="mx-auto w-full max-w-[440px] px-md-4 py-md-4">
               <BackHeader onBack={() => navigate(-1)} />
               <div className="py-16 text-center">
                  <h1 className="text-md-h5 font-semibold text-md-heading">Loan not found</h1>
                  <p className="mt-md-2 text-md-b2 text-md-neutral-700">This support link is invalid or the loan is no longer available.</p>
               </div>
            </div>
         </div>
      );
   }

   if (success) {
      return <SuccessScreen borrowerName={borrowerName} success={success} onBack={() => navigate(-1)} onViewSupported={() => navigate('/lender/supported')} />;
   }

   const alreadyOwned = data.ownsLoanNote;
   const notSellable = !data.isSellable && !alreadyOwned;

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto w-full max-w-[440px] px-md-4 py-md-4">
            <header className="flex items-start gap-3">
               <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md-pill bg-md-neutral-100 text-md-primary-1200 shadow-md-card transition hover:bg-md-primary-100 focus:outline-none focus:ring-2 focus:ring-md-primary-500"
                  aria-label="Go back"
               >
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
               </button>
               <div>
                  <h1 className="text-[28px] font-semibold leading-[1.2] tracking-[-1.12px] text-md-heading">Support {borrowerName}</h1>
                  <p className="mt-1 text-md-b2 text-[#6d6d6d]">Fund this loan and receive the repayment if {borrowerName} pays back.</p>
               </div>
            </header>

            {/* Request Card — matches the request-board card (rounded-24, amount box, Send CTA) */}
            <div className="relative mt-md-4 flex flex-col gap-4 rounded-[24px] border border-[#f0f0f0] bg-white p-md-4 shadow-[0px_11px_24px_0px_rgba(0,0,0,0.02)]">
               <div className="flex gap-4 items-center">
                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                     <div className="flex items-center gap-md-2">
                        <UserAvatar src={data.borrowerAvatarUrl ?? undefined} alt={borrowerName} size={40} />
                        <p className="text-md-h5 font-semibold text-md-heading">{borrowerName}</p>
                     </div>
                     <div className="flex items-center gap-2 flex-wrap">
                        {data.borrowerUsername ? <p className="text-md-b3 text-md-neutral-700">@{data.borrowerUsername}</p> : null}
                        {data.borrowerCreditLevel != null ? (
                           <span className="inline-flex items-center justify-center px-md-1 py-md-0 rounded-[30px] border border-md-primary-900 bg-md-primary-100">
                              <span className="text-md-b4 font-semibold text-md-primary-1200">Trust level {data.borrowerCreditLevel}</span>
                           </span>
                        ) : null}
                     </div>
                     <div className="flex items-center gap-1 text-md-b2 font-semibold">
                        <span className="text-[#585858]">Due On</span>
                        <span className="text-md-red-600">{fmtDate(data.dueDate)}</span>
                     </div>
                  </div>

                  <div className="shrink-0 w-[134px] bg-white border border-[#f0f0f0] rounded-[12px] p-3 flex flex-col gap-5 self-stretch justify-center">
                     <div className="flex flex-col gap-1">
                        <p className="text-[12px] font-medium leading-[18px] tracking-[-0.24px] text-[#585858]">Amount funded</p>
                        <p className="text-[20px] leading-[1.2] tracking-[-0.04em] font-semibold text-md-heading">{usd(data.principal)}</p>
                     </div>
                     <div className="flex flex-col gap-1">
                        <p className="text-[12px] font-medium leading-[18px] tracking-[-0.24px] text-[#585858]">Will repay</p>
                        <p className="text-[20px] leading-[1.2] tracking-[-0.04em] font-semibold text-md-green-600">{usd(data.totalOwed)}</p>
                     </div>
                  </div>
               </div>

               {data.loanPurpose ? <p className="text-md-b2 text-md-neutral-700">{data.loanPurpose}</p> : null}

               <div className="grid grid-cols-2 gap-3">
                  <BoxedStat label="Remaining owed" value={usd(data.remainingOwed)} />
                  <BoxedStat label="IOU points reward" value={`${data.iouPointsReward.toLocaleString()} pts`} />
               </div>

               <p className="rounded-[16px] bg-md-primary-100/60 px-3 py-2.5 text-md-b3 font-medium text-md-neutral-1500">
                  If {borrowerName} repays, the repayment is automatically sent to your wallet — you don’t need to claim anything.
               </p>

               {alreadyOwned ? (
                  <div className="rounded-md-input border border-md-green-100 bg-md-green-100/60 px-3 py-2.5 text-center">
                     <p className="text-md-b3 font-medium text-md-green-900">You already own this Loan Note.</p>
                     <button
                        type="button"
                        onClick={() => navigate('/lender/supported')}
                        className="mt-1 text-md-b3 font-semibold text-md-primary-1200 underline underline-offset-2"
                     >
                        View My Funded Loans
                     </button>
                  </div>
               ) : (
                  <button
                     onClick={handleSupport}
                     disabled={busy || notSellable}
                     type="button"
                     className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary-900"
                  >
                     {notSellable ? 'Not available for purchase' : primaryLabel}
                     {!busy && !notSellable ? <Send className="w-5 h-5" /> : null}
                  </button>
               )}

               {!isLoggedIn ? (
                  <p className="text-center text-md-b3 text-md-neutral-800">
                     You’ll be asked to sign in or sign up, then returned here to complete your support.
                  </p>
               ) : null}
            </div>
         </div>

         {showWalletChecklist && data ? (
            <LendChecklistModal
               title="Fund this loan"
               amountLabel={usd(data.listingPrice)}
               borrowerName={borrowerName}
               connected={Boolean(address)}
               connectedAddress={address}
               isProcessing={busy}
               onConnect={() => openConnectModal?.()}
               onConfirm={handleConfirmFromChecklist}
               onClose={() => setShowWalletChecklist(false)}
            />
         ) : null}
      </div>
   );
}

function BackHeader({ onBack, className = '' }: { onBack: () => void; className?: string }) {
   return (
      <div className={className}>
         <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md-pill bg-md-neutral-100 text-md-primary-1200 shadow-md-card transition hover:bg-md-primary-100 focus:outline-none focus:ring-2 focus:ring-md-primary-500"
            aria-label="Go back"
         >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
         </button>
      </div>
   );
}

function BoxedStat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
   return (
      <div className={`bg-white border border-[#f0f0f0] rounded-[12px] p-3 flex flex-col gap-1 ${className}`}>
         <p className="text-[12px] font-medium leading-[18px] tracking-[-0.24px] text-[#585858]">{label}</p>
         <p className="text-[20px] font-semibold leading-[1.2] tracking-[-0.04em] text-md-heading">{value}</p>
      </div>
   );
}

function SuccessScreen({
   borrowerName,
   success,
   onBack,
   onViewSupported
}: {
   borrowerName: string;
   success: BuyResult;
   onBack: () => void;
   onViewSupported: () => void;
}) {
   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-5 px-md-6 py-md-4 text-center">
            <BackHeader onBack={onBack} className="w-full" />
            <img src="/icons/check-3d.png" alt="" className="mt-md-3 size-[104px]" />
            <div className="flex flex-col gap-1">
               <h1 className="text-[28px] font-semibold leading-[1.2] tracking-[-1.12px] text-md-heading">Thank you for funding</h1>
               <p className="text-md-b1 font-medium text-[#6d6d6d]">
                  You funded {borrowerName}’s loan. If they repay, the repayment is sent straight to your wallet — no claim needed.
               </p>
            </div>

            <dl className="w-full space-y-md-1 rounded-[16px] border border-[#f0f0f0] bg-white p-md-3 text-left">
               <Row label="Loan Note ID" value={`#${success.loanNoteId}`} />
               <Row label="Purchase amount" value={usd(success.purchaseAmount)} />
               <Row label="Expected repayment" value={usd(success.expectedRepayment)} />
               <Row label="Due date" value={fmtDate(success.dueDate)} />
               <Row label="IOU points earned" value={`${success.iouPoints.toLocaleString()} pts`} />
            </dl>

            {success.txHash ? (
               <a
                  href={txExplorerUrl(success.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-md-b3 font-semibold text-md-primary-1200 underline underline-offset-2"
               >
                  View transaction on Basescan ↗
               </a>
            ) : null}

            {!success.synced ? (
               <p className="rounded-[16px] bg-[rgba(255,237,161,0.35)] p-md-3 text-md-b3 text-[#8a6d00]">
                  Your purchase is confirmed on-chain (you own the Loan Note). We’re still syncing it to your dashboard — it’ll appear
                  shortly. Your funds and IOU points are safe.
               </p>
            ) : null}

            <button
               type="button"
               onClick={onViewSupported}
               className="w-full bg-md-primary-1200 text-md-neutral-100 text-md-b1 font-semibold py-md-3 rounded-md-lg flex items-center justify-center gap-2 transition-all duration-150 hover:brightness-110 active:scale-[0.98] active:brightness-90"
            >
               View My Funded Loans
               <ChevronRight className="w-5 h-5" />
            </button>
         </div>
      </div>
   );
}

function Row({ label, value }: { label: string; value: string }) {
   return (
      <div className="flex items-center justify-between">
         <dt className="text-md-b2 text-[#585858]">{label}</dt>
         <dd className="text-md-b2 font-semibold text-md-heading">{value}</dd>
      </div>
   );
}
