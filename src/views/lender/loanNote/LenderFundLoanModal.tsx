import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';

import Loading from '@/components/Loading';
import UserAvatar from '@/components/UserAvatar';

import { getLoanNotePageData } from '@/lib/loanNotes/api';
import type { LoanNotePageData } from '@/lib/loanNotes/types';
import type { RootState } from '@/store/store';
import { type BuyResult, useBuyLoanNote } from '@/views/lender/loanNote/useBuyLoanNote';

const usd = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;

interface Props {
   loanId: string;
   onClose: () => void;
}

/**
 * Dashboard funding popup: a focused modal letting a logged-in lender fund one specific
 * borrower's existing Moodeng loan (buy the Loan Note) without going through the request
 * board. Repayments later auto-route to the lender — no claim step.
 */
export default function LenderFundLoanModal({ loanId, onClose }: Props) {
   const navigate = useNavigate();
   const { address } = useAccount();
   const { buy, busy } = useBuyLoanNote();
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const [success, setSuccess] = useState<BuyResult | null>(null);

   const { data, isLoading } = useQuery<LoanNotePageData | null>({
      queryKey: ['loan-note-popup', loanId, userId ?? null, address ?? null],
      queryFn: () => getLoanNotePageData(loanId, { userId, walletAddress: address }),
      enabled: Boolean(loanId)
   });

   const borrowerName = data?.borrowerDisplayName ?? 'this borrower';

   const handleSupport = async () => {
      if (!data) return;
      const result = await buy(data);
      if (result) setSuccess(result);
   };

   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={busy ? undefined : onClose}>
         <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onClose} disabled={busy} className="float-right text-gray-400 hover:text-gray-600" aria-label="Close">
               ✕
            </button>

            {isLoading ? (
               <Loading />
            ) : !data ? (
               <div className="py-8 text-center text-gray-500">This loan is no longer available.</div>
            ) : success ? (
               <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">🎉</div>
                  <h2 className="text-xl font-bold text-gray-900">You funded {borrowerName}’s loan</h2>
                  <p className="mt-2 text-sm text-gray-600">
                     You funded this loan. If {borrowerName} repays, the repayment is automatically sent to your wallet.
                  </p>
                  <dl className="mt-4 space-y-2 rounded-xl border border-gray-200 p-4 text-left text-sm">
                     <Row label="Loan Note ID" value={`#${success.loanNoteId}`} />
                     <Row label="You paid" value={usd(success.purchaseAmount)} />
                     <Row label="Expected repayment" value={usd(success.expectedRepayment)} />
                     <Row label="IOU points earned" value={`${success.iouPoints.toLocaleString()} pts`} />
                  </dl>
                  <button
                     type="button"
                     onClick={() => navigate('/lender/supported')}
                     className="mt-4 w-full rounded-xl bg-[#0052FF] px-5 py-3 font-semibold text-white hover:bg-[#0041cc]"
                  >
                     View My Funded Loans
                  </button>
               </div>
            ) : (
               <>
                  <h2 className="text-xl font-bold text-gray-900">Fund {borrowerName}’s loan</h2>
                  <div className="mt-4 flex items-center gap-3">
                     <UserAvatar src={data.borrowerAvatarUrl ?? undefined} alt={borrowerName} size={48} />
                     <div>
                        <div className="font-semibold text-gray-900">{borrowerName}</div>
                        {data.borrowerUsername ? <div className="text-sm text-gray-500">@{data.borrowerUsername}</div> : null}
                     </div>
                  </div>

                  {data.loanPurpose ? <p className="mt-3 text-sm text-gray-600">{data.loanPurpose}</p> : null}

                  <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                     <div>
                        <dt className="text-xs text-gray-400">You pay</dt>
                        <dd className="font-semibold text-gray-900">{usd(data.listingPrice)}</dd>
                     </div>
                     <div>
                        <dt className="text-xs text-gray-400">You receive</dt>
                        <dd className="font-semibold text-gray-900">{usd(data.expectedRepayment)}</dd>
                     </div>
                     <div>
                        <dt className="text-xs text-gray-400">IOU points</dt>
                        <dd className="font-semibold text-gray-900">{data.iouPointsReward.toLocaleString()}</dd>
                     </div>
                  </dl>

                  <p className="mt-4 rounded-xl bg-[#0052FF]/5 p-3 text-xs text-gray-600">
                     If {borrowerName} repays, the repayment is automatically sent to your wallet — you don’t need to claim anything.
                  </p>
                  <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                     Repayment is not guaranteed. If the borrower does not repay, you may lose some or all of your purchase amount.
                  </p>

                  <button
                     type="button"
                     onClick={handleSupport}
                     disabled={busy || (!data.isSellable && !data.ownsLoanNote)}
                     className="mt-4 w-full rounded-xl bg-[#0052FF] px-5 py-3 font-semibold text-white hover:bg-[#0041cc] disabled:opacity-50"
                  >
                     {busy ? 'Processing…' : !address ? `Connect wallet to fund ${borrowerName}’s loan` : `Fund ${borrowerName}’s loan`}
                  </button>
                  <p className="mt-2 text-center text-xs text-gray-400">
                     If {borrowerName} repays, the repayment comes straight to your wallet.
                  </p>
               </>
            )}
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
