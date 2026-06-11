import { useMemo, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from 'wagmi';

import Loading from '@/components/Loading';
import UserAvatar from '@/components/UserAvatar';

import { txExplorerUrl } from '@/config/loanFundingConfig';
import { getLoanNotePageData } from '@/lib/loanNotes/api';
import type { LoanNotePageData } from '@/lib/loanNotes/types';
import type { RootState } from '@/store/store';
import { PENDING_FUND_LOAN_KEY } from '@/views/lender/loanNote/fundingPopup';
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
   const { buy, busy, step } = useBuyLoanNote();

   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const username = useSelector((state: RootState) => state.auth.username);
   const isLoggedIn = Boolean(userId && username);

   const [success, setSuccess] = useState<BuyResult | null>(null);

   const { data, isLoading, isError, refetch } = useQuery<LoanNotePageData | null>({
      queryKey: ['loan-note-page', loanId, userId ?? null, address ?? null],
      queryFn: () => getLoanNotePageData(loanId, { userId, walletAddress: address }),
      enabled: Boolean(loanId)
   });

   const borrowerName = data?.borrowerDisplayName ?? 'this borrower';

   const requireLoginThenPopup = () => {
      // Stash the loan so the post-login funding popup opens for this borrower
      // (instead of routing the lender through the request board).
      try {
         window.sessionStorage.setItem(PENDING_FUND_LOAN_KEY, loanId);
      } catch {
         /* ignore storage errors */
      }
      navigate('/sign-in');
   };

   const handleSupport = async () => {
      if (!data) return;
      if (!isLoggedIn) {
         requireLoginThenPopup();
         return;
      }
      const result = await buy(data);
      if (result) setSuccess(result);
   };

   const primaryLabel = useMemo(() => {
      if (step === 'checking') return 'Checking balance…';
      if (step === 'approving') return 'Approving USDC…';
      if (step === 'buying') return 'Confirming purchase…';
      if (step === 'recording') return 'Finalizing…';
      if (busy) return 'Processing…';
      if (!isLoggedIn) return `Support ${borrowerName}`;
      if (!address) return 'Connect wallet to continue';
      return `Fund ${borrowerName}’s loan`;
   }, [step, busy, isLoggedIn, address, borrowerName]);

   if (isLoading) return <Loading />;
   if (isError || !data) {
      return (
         <div className="mx-auto max-w-xl px-4 py-16 text-center">
            <h1 className="text-xl font-semibold text-gray-900">Loan not found</h1>
            <p className="mt-2 text-gray-500">This support link is invalid or the loan is no longer available.</p>
         </div>
      );
   }

   if (success) {
      return <SuccessScreen borrowerName={borrowerName} success={success} onViewSupported={() => navigate('/lender/supported')} />;
   }

   const alreadyOwned = data.ownsLoanNote;
   const notSellable = !data.isSellable && !alreadyOwned;

   return (
      <div className="mx-auto max-w-2xl px-4 py-8">
         <h1 className="text-2xl font-bold text-gray-900">Support {borrowerName}</h1>
         <p className="mt-1 text-sm text-gray-500">Fund this loan and receive the repayment if {borrowerName} pays back.</p>

         {/* Borrower profile card */}
         <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-4">
               <UserAvatar src={data.borrowerAvatarUrl ?? undefined} alt={borrowerName} size={56} />
               <div>
                  <div className="text-lg font-semibold text-gray-900">{borrowerName}</div>
                  {data.borrowerUsername ? <div className="text-sm text-gray-500">@{data.borrowerUsername}</div> : null}
                  {data.borrowerCreditLevel != null ? (
                     <div className="mt-1 inline-block rounded-full bg-[#0052FF]/10 px-2 py-0.5 text-xs font-medium text-[#0052FF]">
                        Trust level {data.borrowerCreditLevel}
                     </div>
                  ) : null}
               </div>
            </div>

            {data.loanPurpose ? (
               <div className="mt-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">Loan purpose</div>
                  <p className="mt-1 text-sm text-gray-700">{data.loanPurpose}</p>
               </div>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
               <Stat label="Amount originally funded" value={usd(data.principal)} />
               <Stat label="Borrower will repay" value={usd(data.totalOwed)} />
               <Stat label="Remaining owed" value={usd(data.remainingOwed)} />
               <Stat label="Due date" value={fmtDate(data.dueDate)} />
               <Stat
                  label="Repayment history"
                  value={
                     data.repaymentStats.loansFunded > 0
                        ? `${data.repaymentStats.loansRepaid}/${data.repaymentStats.loansFunded} repaid${data.repaymentStats.repaymentRatePct != null ? ` (${data.repaymentStats.repaymentRatePct}%)` : ''}`
                        : 'New borrower'
                  }
               />
               <Stat label="IOU points reward" value={`${data.iouPointsReward.toLocaleString()} pts`} />
            </dl>
         </div>

         {/* Economics */}
         <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="grid grid-cols-3 gap-4 text-center">
               <div>
                  <div className="text-xs text-gray-400">Your purchase</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{usd(data.listingPrice)}</div>
               </div>
               <div>
                  <div className="text-xs text-gray-400">Expected repayment</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{usd(data.expectedRepayment)}</div>
               </div>
               <div>
                  <div className="text-xs text-gray-400">Expected yield</div>
                  <div className="mt-1 text-lg font-semibold text-emerald-600">{usd(data.expectedProfit)}</div>
               </div>
            </div>
         </div>

         {/* Disclosure */}
         <div className="mt-4 rounded-2xl bg-[#0052FF]/5 p-5 text-sm text-gray-700">
            <p>If {borrowerName} repays, the repayment is automatically sent to your wallet — you don’t need to claim anything.</p>
         </div>

         {/* Risk warning */}
         <div className="mt-4 rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">
            ⚠️ Repayment is not guaranteed. If the borrower does not repay, you may lose some or all of your purchase amount.
         </div>

         {alreadyOwned ? (
            <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-center text-sm text-emerald-700">
               You already own this Loan Note.
               <button type="button" onClick={() => navigate('/lender/supported')} className="ml-2 font-medium underline">
                  View My Funded Loans
               </button>
            </div>
         ) : (
            <div className="mt-6">
               <button
                  type="button"
                  onClick={handleSupport}
                  disabled={busy || notSellable}
                  className="w-full rounded-xl bg-[#0052FF] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#0041cc] disabled:opacity-50"
               >
                  {notSellable ? 'Not available for purchase' : primaryLabel}
               </button>
               <p className="mt-2 text-center text-xs text-gray-500">
                  If {borrowerName} repays, the repayment comes straight to your wallet.
               </p>
               {isLoggedIn && address ? (
                  <p className="mt-1 text-center text-xs text-gray-400">
                     Repayments are automatically sent to your wallet when the borrower repays — you do not need to manually claim.
                  </p>
               ) : null}
            </div>
         )}

         {!isLoggedIn ? (
            <p className="mt-4 text-center text-xs text-gray-400">You’ll be asked to sign in or sign up, then returned here to complete your support.</p>
         ) : null}

         {/* refetch is wired for callers that want to refresh after external changes */}
         <button type="button" onClick={() => refetch()} className="sr-only">
            Refresh
         </button>
      </div>
   );
}

function Stat({ label, value }: { label: string; value: string }) {
   return (
      <div>
         <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
         <dd className="mt-0.5 font-medium text-gray-900">{value}</dd>
      </div>
   );
}

function SuccessScreen({ borrowerName, success, onViewSupported }: { borrowerName: string; success: BuyResult; onViewSupported: () => void }) {
   return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center">
         <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">🎉</div>
         <h1 className="text-2xl font-bold text-gray-900">You funded {borrowerName}’s loan</h1>
         <p className="mt-2 text-gray-600">
            You funded this loan. If {borrowerName} repays, the repayment is automatically sent to your wallet.
         </p>

         <dl className="mt-6 space-y-3 rounded-2xl border border-gray-200 bg-white p-5 text-left text-sm">
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
               className="mt-3 inline-block text-xs font-medium text-[#0052FF] underline"
            >
               View transaction on Basescan ↗
            </a>
         ) : null}

         {!success.synced ? (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
               Your purchase is confirmed on-chain (you own the Loan Note). We’re still syncing it to your dashboard — it’ll appear
               shortly. Your funds and IOU points are safe.
            </p>
         ) : null}

         <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onViewSupported} className="flex-1 rounded-xl bg-[#0052FF] px-6 py-3 font-semibold text-white hover:bg-[#0041cc]">
               View My Funded Loans
            </button>
         </div>
      </div>
   );
}

function Row({ label, value }: { label: string; value: string }) {
   return (
      <div className="flex items-center justify-between">
         <dt className="text-gray-500">{label}</dt>
         <dd className="font-medium text-gray-900">{value}</dd>
      </div>
   );
}
