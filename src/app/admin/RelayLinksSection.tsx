import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { getRelayLoans } from '@/lib/loanNotes/api';
import type { RelayLoan } from '@/lib/loanNotes/types';

const usd = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const shareUrl = (loanId: string) => {
   const origin = typeof window !== 'undefined' ? window.location.origin : '';
   return `${origin}/lend/loan/${loanId}`;
};

const statusTone: Record<RelayLoan['status'], string> = {
   Listed: 'bg-emerald-100 text-emerald-700',
   Sold: 'bg-blue-100 text-blue-700',
   Repaid: 'bg-gray-200 text-gray-700',
   Defaulted: 'bg-red-100 text-red-700'
};

/**
 * Admin "Liquidity Relay" panel (George/Emma only). Lists smart-contract-funded loans and
 * provides a copyable lender funding link for each, plus a ready-to-paste share message.
 * Read-only — sharing a link kicks off the lender purchase flow at /lend/loan/:loanId.
 */
export default function RelayLinksSection() {
   const { data: loans, isLoading, refetch, isRefetching } = useQuery<RelayLoan[]>({
      queryKey: ['admin-relay-loans'],
      queryFn: getRelayLoans
   });
   const [copiedId, setCopiedId] = useState<string | null>(null);

   const copy = async (loan: RelayLoan, withMessage: boolean) => {
      const link = shareUrl(loan.loanId);
      const text = withMessage ? `Help fund ${loan.borrowerDisplayName}'s loan on Moodeng: ${link}` : link;
      try {
         await navigator.clipboard.writeText(text);
         setCopiedId(`${loan.loanId}:${withMessage ? 'msg' : 'link'}`);
         setTimeout(() => setCopiedId(null), 1500);
      } catch {
         /* clipboard unavailable */
      }
   };

   return (
      <section className="space-y-6">
         <div className="flex items-start justify-between gap-4">
            <div>
               <h2 className="break-words text-4xl font-black sm:text-5xl">Liquidity Relay</h2>
               <p className="mt-3 text-2xl text-[#6f627e]">
                  Loans Moodeng fronted via the smart contract. Share a funding link with a lender — they buy the Loan Note, refilling
                  Moodeng&rsquo;s capital. Borrower repayments are then sent automatically to the lender.
               </p>
            </div>
            <button
               type="button"
               onClick={() => refetch()}
               className="shrink-0 rounded-2xl border border-[#ded0ef] bg-white px-5 py-3 text-lg font-black text-[#34234f]"
            >
               {isRefetching ? 'Refreshing…' : 'Refresh'}
            </button>
         </div>

         {isLoading ? (
            <p className="text-xl text-[#6f627e]">Loading…</p>
         ) : !loans || loans.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#ded0ef] p-10 text-center text-xl text-[#6f627e]">
               No smart-contract-funded loans yet. Fund a borrower with “Smart Contract Lend” from the request board to create a
               sellable Loan Note here.
            </div>
         ) : (
            <div className="grid gap-4">
               {loans.map((loan) => {
                  const link = shareUrl(loan.loanId);
                  return (
                     <div key={loan.loanId} className="rounded-3xl border border-[#eadff8] bg-white p-6 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                           <div>
                              <div className="flex items-center gap-2">
                                 <strong className="text-2xl">{loan.borrowerDisplayName}</strong>
                                 <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusTone[loan.status]}`}>{loan.status}</span>
                              </div>
                              {loan.borrowerUsername ? <p className="text-lg text-[#6f627e]">@{loan.borrowerUsername}</p> : null}
                              {loan.onchainLoanId ? <p className="text-base text-[#9a8fb0]">Loan Note #{loan.onchainLoanId}</p> : null}
                           </div>
                           <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-right text-lg">
                              <dt className="text-[#6f627e]">Principal</dt>
                              <dd className="font-bold">${usd(loan.principal)}</dd>
                              <dt className="text-[#6f627e]">Lender pays</dt>
                              <dd className="font-bold">${usd(loan.salePrice)}</dd>
                              <dt className="text-[#6f627e]">Borrower owes</dt>
                              <dd className="font-bold">${usd(loan.totalOwed)}</dd>
                              <dt className="text-[#6f627e]">Lender upside</dt>
                              <dd className="font-bold text-emerald-600">${usd(loan.lenderUpside)}</dd>
                           </dl>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                           <code className="flex-1 truncate rounded-xl bg-[#f5f1fb] px-4 py-3 text-base text-[#34234f]" title={link}>
                              {link}
                           </code>
                           <button
                              type="button"
                              onClick={() => copy(loan, false)}
                              disabled={loan.status !== 'Listed'}
                              className="rounded-xl bg-[#0052FF] px-5 py-3 text-base font-black text-white hover:bg-[#0041cc] disabled:opacity-40"
                           >
                              {copiedId === `${loan.loanId}:link` ? 'Copied!' : 'Copy link'}
                           </button>
                           <button
                              type="button"
                              onClick={() => copy(loan, true)}
                              disabled={loan.status !== 'Listed'}
                              className="rounded-xl border border-[#ded0ef] bg-white px-5 py-3 text-base font-black text-[#34234f] disabled:opacity-40"
                           >
                              {copiedId === `${loan.loanId}:msg` ? 'Copied!' : 'Copy message'}
                           </button>
                        </div>
                        {loan.status !== 'Listed' ? (
                           <p className="mt-2 text-base text-[#9a8fb0]">
                              {loan.status === 'Sold'
                                 ? 'Already funded by a lender — link disabled.'
                                 : loan.status === 'Repaid'
                                   ? 'Loan fully repaid.'
                                   : 'Loan defaulted.'}
                           </p>
                        ) : null}
                     </div>
                  );
               })}
            </div>
         )}
      </section>
   );
}
