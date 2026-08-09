'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { type AdminLoanRecord, listAdminLoans, type LoanExplorerStatus, setEntityTest } from './adminSupabase';
import RemoveLoanRequestDialog from './RemoveLoanRequestDialog';

const FILTERS: Array<{ id: LoanExplorerStatus; label: string }> = [
   { id: 'all', label: 'All' },
   { id: 'requested', label: 'Requested' },
   { id: 'active', label: 'Active' },
   { id: 'overdue', label: 'Not paid back' },
   { id: 'repaid', label: 'Paid back' }
];

type DerivedStatus = 'Requested' | 'Active' | 'Not paid back' | 'Paid back' | 'Unknown';

function deriveStatus(loan: AdminLoanRecord): DerivedStatus {
   if (loan.loan_status === 'Requested') return 'Requested';
   if (loan.loan_status === 'Lent') {
      if (loan.repayment_status === 'Paid') return 'Paid back';
      const overdue = loan.due_date ? new Date(loan.due_date).getTime() < Date.now() : false;
      return overdue ? 'Not paid back' : 'Active';
   }
   return 'Unknown';
}

function statusClass(s: DerivedStatus): string {
   if (s === 'Paid back') return 'bg-emerald-900/50 text-emerald-300';
   if (s === 'Active') return 'bg-blue-900/50 text-blue-300';
   if (s === 'Not paid back') return 'bg-red-900/50 text-red-300';
   if (s === 'Requested') return 'bg-purple-900/50 text-purple-300';
   return 'bg-[#241044] text-[#a89bb8]';
}

function money(value: number | null | undefined): string {
   return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function shortDate(value: string | null): string {
   if (!value) return '—';
   const d = new Date(value);
   return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function LoanExplorerSection() {
   const [loans, setLoans] = useState<AdminLoanRecord[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [filter, setFilter] = useState<LoanExplorerStatus>('all');
   const [search, setSearch] = useState('');
   const [hideTest, setHideTest] = useState(true);
   const [busy, setBusy] = useState<string | null>(null);
   const [removing, setRemoving] = useState<AdminLoanRecord | null>(null);

   const load = useCallback(async (status: LoanExplorerStatus, includeTest: boolean) => {
      setLoading(true);
      setError(null);
      try {
         setLoans(await listAdminLoans(status, { includeTest }));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load loans.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load(filter, !hideTest);
   }, [filter, hideTest, load]);

   const toggleTest = useCallback(async (loan: AdminLoanRecord) => {
      setBusy(loan.id);
      setError(null);
      try {
         await setEntityTest('loan', loan.id, !loan.is_test);
         setLoans((prev) => prev.map((row) => (row.id === loan.id ? { ...row, is_test: !loan.is_test } : row)));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not update loan.');
      } finally {
         setBusy(null);
      }
   }, []);

   const shown = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return loans;
      return loans.filter((l) => {
         const fields = [
            l.tracking_id,
            l.borrower?.username,
            l.lender?.username,
            l.borrower_wallet,
            l.lender_wallet,
            l.reason
         ];
         return fields.some((f) => (f ?? '').toLowerCase().includes(q));
      });
   }, [loans, search]);

   return (
      <div className="space-y-4">
         <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-3xl font-black">
               Loans <span className="text-xl font-bold text-[#a89bb8]">({shown.length})</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
               {FILTERS.map((f) => (
                  <button
                     key={f.id}
                     type="button"
                     onClick={() => setFilter(f.id)}
                     className={`rounded-full px-4 py-1.5 text-sm font-black ${filter === f.id ? 'bg-[#8336f0] text-white' : 'bg-[#241044] text-[#a89bb8]'}`}
                  >
                     {f.label}
                  </button>
               ))}
               <button
                  type="button"
                  onClick={() => setHideTest((v) => !v)}
                  className={`rounded-full px-4 py-1.5 text-sm font-black ${hideTest ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'}`}
               >
                  {hideTest ? 'Test data hidden' : 'Showing test data'}
               </button>
               <button
                  type="button"
                  onClick={() => load(filter, !hideTest)}
                  disabled={loading}
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
               >
                  {loading ? '…' : 'Refresh'}
               </button>
            </div>
         </div>

         <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking ID, borrower, lender, wallet, or reason"
            className="w-full rounded-xl border border-[#3d1f6e] bg-[#241044] px-4 py-3 text-base font-bold text-white placeholder:text-[#6f6385]"
         />

         {error ? (
            <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-lg font-bold text-red-300">{error}</div>
         ) : null}

         {shown.length ? (
            <div className="overflow-x-auto rounded-2xl border border-[#2a1453]">
               <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                     <tr className="bg-[#1c0a3a] text-xs font-black uppercase tracking-wide text-[#a89bb8]">
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Tracking</th>
                        <th className="px-4 py-3">Borrower</th>
                        <th className="px-4 py-3">Lender</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-right">Repaid</th>
                        <th className="px-4 py-3">Due</th>
                        <th className="px-4 py-3">Requested</th>
                        <th className="px-4 py-3 text-right">Data</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody>
                     {shown.map((l) => {
                        const status = deriveStatus(l);
                        return (
                           <tr key={l.id} className="border-t border-[#241044] bg-[#150730] align-top">
                              <td className="px-4 py-3">
                                 <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase ${statusClass(status)}`}>
                                    {status}
                                 </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-sm font-bold text-[#cfc6dd]">{l.tracking_id}</td>
                              <td className="px-4 py-3 text-sm font-bold text-white">{l.borrower?.username ?? '—'}</td>
                              <td className="px-4 py-3 text-sm font-bold text-white">{l.lender?.username ?? '—'}</td>
                              <td className="px-4 py-3 text-right text-sm font-black text-white">{money(l.loan_amount)}</td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-[#cfc6dd]">
                                 {l.repaid_amount == null ? '—' : money(l.repaid_amount)}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-[#a89bb8]">{shortDate(l.due_date)}</td>
                              <td className="px-4 py-3 text-sm font-medium text-[#a89bb8]">{shortDate(l.created_at)}</td>
                              <td className="px-4 py-3 text-right">
                                 <button
                                    type="button"
                                    onClick={() => toggleTest(l)}
                                    disabled={busy === l.id}
                                    title={l.is_test ? 'Marked as test — click to mark real' : 'Real loan — click to mark as test'}
                                    className={`rounded-full px-3 py-1 text-xs font-black uppercase disabled:opacity-50 ${l.is_test ? 'bg-amber-900/50 text-amber-300' : 'bg-[#241044] text-[#a89bb8]'}`}
                                 >
                                    {l.is_test ? 'Test' : 'Real'}
                                 </button>
                              </td>
                              <td className="px-4 py-3 text-right">
                                 {status === 'Requested' ? (
                                    <button
                                       type="button"
                                       onClick={() => setRemoving(l)}
                                       title="Remove this request and tell the borrower why"
                                       className="rounded-full bg-red-900/50 px-3 py-1 text-xs font-black uppercase text-red-300"
                                    >
                                       Remove
                                    </button>
                                 ) : (
                                    <span className="text-xs font-bold text-[#6f6385]">—</span>
                                 )}
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         ) : (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               {loading ? 'Loading loans…' : 'No loans match.'}
            </div>
         )}

         {removing ? (
            <RemoveLoanRequestDialog
               loan={removing}
               onClose={() => setRemoving(null)}
               onRemoved={() => setLoans((prev) => prev.filter((row) => row.id !== removing.id))}
            />
         ) : null}
      </div>
   );
}
