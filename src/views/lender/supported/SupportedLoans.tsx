import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import Loading from '@/components/Loading';

import { getMyFundedLoans, getMyIouPoints } from '@/lib/loanNotes/api';
import type { FundedLoan } from '@/lib/loanNotes/types';

const usd = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
const shortWallet = (w: string | null) => (w && w.length > 10 ? `${w.slice(0, 6)}…${w.slice(-4)}` : (w ?? '—'));

const statusBadge = (status: string) => {
   const map: Record<string, string> = {
      Active: 'bg-blue-100 text-blue-700',
      Repaid: 'bg-emerald-100 text-emerald-700',
      Defaulted: 'bg-red-100 text-red-700'
   };
   return map[status] ?? 'bg-gray-100 text-gray-600';
};

/**
 * "My Funded Loans" — Loan Notes the lender owns. Repayments are automatically sent to
 * the lender's wallet when the borrower repays, so there is no claim action here.
 */
export default function SupportedLoans() {
   const navigate = useNavigate();

   const { data: loans, isLoading } = useQuery<FundedLoan[]>({
      queryKey: ['my-funded-loans'],
      queryFn: getMyFundedLoans
   });
   const { data: points } = useQuery<number>({ queryKey: ['my-iou-points'], queryFn: getMyIouPoints });

   if (isLoading) return <Loading />;

   return (
      <div className="mx-auto max-w-3xl px-4 py-8">
         <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">My Funded Loans</h1>
            <div className="rounded-full bg-[#0052FF]/10 px-3 py-1 text-sm font-medium text-[#0052FF]">
               {(points ?? 0).toLocaleString()} IOU points
            </div>
         </div>
         <p className="mt-1 text-sm text-gray-500">Repayments are automatically sent to your wallet when the borrower repays.</p>

         {!loans || loans.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
               You haven’t funded any loans yet. Funding links are shared directly with you.
            </div>
         ) : (
            <div className="mt-6 space-y-4">
               {loans.map((loan) => (
                  <div key={loan.loanId} className="rounded-2xl border border-gray-200 bg-white p-5">
                     <div className="flex items-start justify-between">
                        <div>
                           <div className="text-lg font-semibold text-gray-900">{loan.borrowerDisplayName}</div>
                           {loan.borrowerUsername ? <div className="text-sm text-gray-500">@{loan.borrowerUsername}</div> : null}
                           {loan.onchainLoanId ? <div className="mt-0.5 text-xs text-gray-400">Loan Note #{loan.onchainLoanId}</div> : null}
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(loan.status)}`}>{loan.status}</span>
                     </div>

                     <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <div>
                           <dt className="text-xs text-gray-400">Amount paid</dt>
                           <dd className="font-medium text-gray-900">{usd(loan.amountPaid)}</dd>
                        </div>
                        <div>
                           <dt className="text-xs text-gray-400">Borrower owes</dt>
                           <dd className="font-medium text-gray-900">{usd(loan.borrowerOwes)}</dd>
                        </div>
                        <div>
                           <dt className="text-xs text-gray-400">Released to you</dt>
                           <dd className="font-medium text-emerald-600">{usd(loan.amountReleasedToYou)}</dd>
                        </div>
                        <div>
                           <dt className="text-xs text-gray-400">Held in contract</dt>
                           <dd className="font-medium text-gray-900">{usd(loan.heldInContract)}</dd>
                        </div>
                        <div>
                           <dt className="text-xs text-gray-400">IOU earned</dt>
                           <dd className="font-medium text-gray-900">{loan.iouPointsEarned.toLocaleString()} pts</dd>
                        </div>
                        <div className="col-span-2">
                           <dt className="text-xs text-gray-400">Repayment destination</dt>
                           <dd className="font-medium text-gray-900" title={loan.repaymentWallet ?? undefined}>
                              {shortWallet(loan.repaymentWallet)}
                           </dd>
                        </div>
                     </dl>

                     <p className="mt-3 text-xs text-gray-400">
                        Repayments are sent to your wallet automatically — when {loan.borrowerDisplayName} fully repays, or on the due
                        date for whatever has been paid so far. No claim needed.
                     </p>
                  </div>
               ))}
            </div>
         )}

         <button type="button" onClick={() => navigate(-1)} className="mt-8 text-sm text-gray-500 underline">
            Back
         </button>
      </div>
   );
}
