'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import useWallet, { toSettlementMethod, useActivePaymentMethod } from '@/hooks/useWallet';

import { type ComingDueLoan, listComingDueLoans, refundLoan, type RefundLoanResult } from './adminSupabase';

const DEFAULT_REASON = 'Insufficient credit check';

function money(value: number | null | undefined): string {
   return Number(value ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function shortWallet(w: string | null | undefined): string {
   if (!w) return '—';
   return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

// A refund unwinds the lender's PRINCIPAL only (loan_amount), matching how the loan was funded.
function principal(loan: ComingDueLoan): number {
   return Number(loan.loan_amount ?? 0);
}

export default function RefundSection() {
   const [loans, setLoans] = useState<ComingDueLoan[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [hideTest, setHideTest] = useState(true);
   const [search, setSearch] = useState('');

   // Modal + in-flight state
   const [target, setTarget] = useState<ComingDueLoan | null>(null);
   const [reason, setReason] = useState(DEFAULT_REASON);
   const [step, setStep] = useState<'idle' | 'sending' | 'recording'>('idle');
   const [done, setDone] = useState<Record<string, RefundLoanResult>>({});

   const method = useActivePaymentMethod();
   const { payUsdc } = useWallet();

   const load = useCallback(async (includeTest: boolean) => {
      setLoading(true);
      setError(null);
      try {
         setLoans(await listComingDueLoans({ includeTest }));
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not load loans.');
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load(!hideTest);
   }, [hideTest, load]);

   const shown = useMemo(() => {
      const q = search.trim().toLowerCase();
      return loans
         .filter((l) => !done[l.id]) // hide loans refunded this session
         .filter((l) => {
            if (!q) return true;
            const fields = [l.tracking_id, l.borrower?.username, l.lender?.username, l.reason];
            return fields.some((f) => (f ?? '').toLowerCase().includes(q));
         });
   }, [loans, search, done]);

   const openConfirm = useCallback((loan: ComingDueLoan) => {
      setTarget(loan);
      setReason(DEFAULT_REASON);
      setStep('idle');
      setError(null);
   }, []);

   const closeConfirm = useCallback(() => {
      if (step !== 'idle') return; // don't let the admin close mid-flight
      setTarget(null);
   }, [step]);

   const handleRefund = useCallback(async () => {
      if (!target) return;
      const lenderWallet = target.lender?.wallet_address;
      if (!lenderWallet) {
         setError('This lender has no wallet on file — cannot send a refund.');
         return;
      }
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
         setError('Please enter a reason for the refund.');
         return;
      }
      const amount = principal(target);
      setError(null);

      // 1) Send the USDC from the admin's connected wallet to the lender.
      setStep('sending');
      let outcome: { hash: string } | null = null;
      try {
         outcome = await payUsdc({
            method,
            to: lenderWallet,
            usdAmount: String(amount),
            loanId: target.id,
            coin: target.coin ?? 'USDC'
         });
      } catch (err) {
         setError(err instanceof Error ? err.message : 'The wallet transfer failed.');
         setStep('idle');
         return;
      }
      if (!outcome) {
         // payUsdc self-toasts on failure/rejection and returns null.
         setStep('idle');
         return;
      }

      // 2) Record the refund server-side: verify on-chain, cancel loan, ban + blacklist, notify.
      setStep('recording');
      try {
         const result = await refundLoan({
            loanId: target.id,
            hash: outcome.hash,
            method: toSettlementMethod(method),
            reason: trimmedReason
         });
         setDone((prev) => ({ ...prev, [target.id]: result }));
         setTarget(null);
         if (result.errors.length) {
            setError(`Refund recorded, but some follow-up steps reported issues: ${result.errors.join('; ')}`);
         }
      } catch (err) {
         // The money HAS left the admin's wallet at this point. Surface the tx hash so it can be
         // retried/reconciled rather than lost.
         setError(
            `${err instanceof Error ? err.message : 'Could not record the refund.'} ` +
               `The on-chain transfer (${outcome.hash}) already went out — retry recording once it confirms.`
         );
      } finally {
         setStep('idle');
      }
   }, [target, reason, method, payUsdc]);

   const totalRefundable = useMemo(() => shown.reduce((sum, l) => sum + principal(l), 0), [shown]);

   return (
      <div className="space-y-4">
         <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-3xl font-black">
               Refunds <span className="text-xl font-bold text-[#a89bb8]">({shown.length})</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
               <button
                  type="button"
                  onClick={() => setHideTest((v) => !v)}
                  className={`rounded-full px-4 py-1.5 text-sm font-black ${hideTest ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'}`}
               >
                  {hideTest ? 'Test data hidden' : 'Showing test data'}
               </button>
               <button
                  type="button"
                  onClick={() => load(!hideTest)}
                  disabled={loading}
                  className="rounded-full bg-[#1c053d] px-4 py-1.5 text-sm font-black text-white disabled:opacity-50"
               >
                  {loading ? '…' : 'Refresh'}
               </button>
            </div>
         </div>

         <p className="rounded-2xl border border-[#3d1f6e] bg-[#1c0a3a] px-5 py-3 text-sm font-bold text-[#a89bb8]">
            Refund a lender their principal out of your own wallet. This closes the loan (no longer due) and{' '}
            <span className="text-red-300">bans + KYC-blacklists the borrower</span>. Payment is sent from your connected
            wallet ({method}). These actions are hard to undo.
         </p>

         <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tracking ID, borrower, lender, or reason"
            className="w-full rounded-xl border border-[#3d1f6e] bg-[#241044] px-4 py-3 text-base font-bold text-white placeholder:text-[#6f6385]"
         />

         <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] px-5 py-3 text-sm font-bold text-[#a89bb8]">
            {shown.length} outstanding loan{shown.length === 1 ? '' : 's'} · {money(totalRefundable)} refundable principal
         </div>

         {error ? <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-base font-bold text-red-300">{error}</div> : null}

         {shown.length ? (
            <div className="overflow-x-auto rounded-2xl border border-[#2a1453]">
               <table className="w-full min-w-[960px] border-collapse text-left">
                  <thead>
                     <tr className="bg-[#1c0a3a] text-xs font-black uppercase tracking-wide text-[#a89bb8]">
                        <th className="px-4 py-3">Tracking</th>
                        <th className="px-4 py-3">Lender (refund to)</th>
                        <th className="px-4 py-3">Lender wallet</th>
                        <th className="px-4 py-3 text-right">Principal</th>
                        <th className="px-4 py-3">Borrower (will be banned)</th>
                        <th className="px-4 py-3 text-right">Action</th>
                     </tr>
                  </thead>
                  <tbody>
                     {shown.map((l) => (
                        <tr key={l.id} className="border-t border-[#241044] bg-[#150730] align-top">
                           <td className="px-4 py-3 font-mono text-sm font-bold text-[#cfc6dd]">{l.tracking_id}</td>
                           <td className="px-4 py-3 text-sm font-bold text-white">{l.lender?.username ?? '—'}</td>
                           <td className="px-4 py-3 font-mono text-xs font-medium text-[#a89bb8]" title={l.lender?.wallet_address ?? ''}>
                              {shortWallet(l.lender?.wallet_address)}
                           </td>
                           <td className="px-4 py-3 text-right text-sm font-black text-white">
                              {money(principal(l))} {l.coin ?? 'USDC'}
                           </td>
                           <td className="px-4 py-3 text-sm font-bold text-white">
                              {l.borrower?.username ?? '—'}
                              <div className="text-xs font-medium text-[#a89bb8]">{l.borrower?.email ?? ''}</div>
                           </td>
                           <td className="px-4 py-3 text-right">
                              <button
                                 type="button"
                                 onClick={() => openConfirm(l)}
                                 disabled={!l.lender?.wallet_address}
                                 className="rounded-full bg-[#8336f0] px-4 py-1.5 text-xs font-black uppercase text-white disabled:opacity-50"
                                 title={l.lender?.wallet_address ? 'Refund this lender and ban the borrower' : 'Lender has no wallet on file'}
                              >
                                 Refund lender
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         ) : (
            <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5 text-xl font-black text-[#a89bb8]">
               {loading ? 'Loading loans…' : 'No outstanding loans to refund.'}
            </div>
         )}

         {target ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closeConfirm}>
               <div
                  className="w-full max-w-lg space-y-4 rounded-2xl border border-[#3d1f6e] bg-[#150730] p-6"
                  onClick={(e) => e.stopPropagation()}
               >
                  <h4 className="text-2xl font-black text-white">Confirm refund</h4>
                  <div className="space-y-2 rounded-xl border border-[#2a1453] bg-[#1c0a3a] p-4 text-sm font-bold text-[#cfc6dd]">
                     <div className="flex justify-between gap-4">
                        <span className="text-[#a89bb8]">Send</span>
                        <span className="text-white">
                           {money(principal(target))} {target.coin ?? 'USDC'}
                        </span>
                     </div>
                     <div className="flex justify-between gap-4">
                        <span className="text-[#a89bb8]">To lender</span>
                        <span className="text-white">{target.lender?.username ?? shortWallet(target.lender?.wallet_address)}</span>
                     </div>
                     <div className="flex justify-between gap-4">
                        <span className="text-[#a89bb8]">Wallet</span>
                        <span className="break-all font-mono text-xs text-white">{target.lender?.wallet_address}</span>
                     </div>
                     <div className="flex justify-between gap-4">
                        <span className="text-[#a89bb8]">Loan</span>
                        <span className="font-mono text-xs text-white">{target.tracking_id}</span>
                     </div>
                     <div className="mt-2 border-t border-[#2a1453] pt-2 text-red-300">
                        Borrower <span className="text-white">{target.borrower?.username ?? '—'}</span> will be{' '}
                        <span className="font-black">banned and KYC-blacklisted</span>, and this loan will be closed as no
                        longer due.
                     </div>
                  </div>

                  <label className="block text-sm font-black text-[#a89bb8]">
                     Reason (shown to the lender)
                     <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        disabled={step !== 'idle'}
                        className="mt-1 w-full rounded-xl border border-[#3d1f6e] bg-[#241044] px-4 py-3 text-base font-bold text-white placeholder:text-[#6f6385] disabled:opacity-60"
                     />
                  </label>

                  <div className="flex justify-end gap-2">
                     <button
                        type="button"
                        onClick={closeConfirm}
                        disabled={step !== 'idle'}
                        className="rounded-full bg-[#241044] px-5 py-2 text-sm font-black text-[#cfc6dd] disabled:opacity-50"
                     >
                        Cancel
                     </button>
                     <button
                        type="button"
                        onClick={handleRefund}
                        disabled={step !== 'idle' || !target.lender?.wallet_address}
                        className="rounded-full bg-[#8336f0] px-5 py-2 text-sm font-black text-white disabled:opacity-50"
                     >
                        {step === 'sending'
                           ? 'Sending USDC…'
                           : step === 'recording'
                             ? 'Recording refund…'
                             : `Send ${money(principal(target))} & refund`}
                     </button>
                  </div>
               </div>
            </div>
         ) : null}
      </div>
   );
}
