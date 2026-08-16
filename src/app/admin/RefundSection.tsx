'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import useWallet, { toSettlementMethod, useActivePaymentMethod } from '@/hooks/useWallet';

import {
   type ComingDueLoan,
   getLoanRefundState,
   listComingDueLoans,
   refundLoan,
   type RefundLoanResult
} from './adminSupabase';

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

// A refund USDC transfer that already landed but whose server-side recording failed. We keep the
// hash so the admin can FINISH RECORDING without sending money a second time.
interface PendingRecord {
   hash: string;
   method: 'wallet' | 'base';
   reason: string;
}

export default function RefundSection() {
   const [loans, setLoans] = useState<ComingDueLoan[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [notice, setNotice] = useState<string | null>(null);
   const [hideTest, setHideTest] = useState(true);
   const [search, setSearch] = useState('');

   const [target, setTarget] = useState<ComingDueLoan | null>(null);
   const [reason, setReason] = useState(DEFAULT_REASON);
   const [step, setStep] = useState<'idle' | 'checking' | 'sending' | 'recording'>('idle');
   const [done, setDone] = useState<Record<string, RefundLoanResult>>({});
   const [pending, setPending] = useState<Record<string, PendingRecord>>({});

   // Hard idempotency guard: once a SEND is initiated for a loan this session, its id lands here and
   // no second send can ever fire for it — belt-and-braces on top of the disabled buttons and the
   // server-side refunded_at check. A ref (not state) so it's synchronous within a click handler.
   const sendInitiated = useRef<Set<string>>(new Set());

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
         .filter((l) => !done[l.id]) // refunded this session → gone from the page
         .filter((l) => {
            if (!q) return true;
            const fields = [l.tracking_id, l.borrower?.username, l.lender?.username, l.reason];
            return fields.some((f) => (f ?? '').toLowerCase().includes(q));
         });
   }, [loans, search, done]);

   const openConfirm = useCallback((loan: ComingDueLoan) => {
      setTarget(loan);
      setReason(pending[loan.id]?.reason ?? DEFAULT_REASON);
      setStep('idle');
      setError(null);
      setNotice(null);
   }, [pending]);

   const closeConfirm = useCallback(() => {
      if (step !== 'idle') return; // never close mid-flight
      setTarget(null);
   }, [step]);

   // Persist the refund server-side (verify on-chain → cancel loan → ban + blacklist → notify).
   // Shared by the first attempt and the "finish recording" retry so we never duplicate the send.
   const record = useCallback(
      async (loan: ComingDueLoan, hash: string, settleMethod: 'wallet' | 'base', trimmedReason: string) => {
         setStep('recording');
         try {
            const result = await refundLoan({ loanId: loan.id, hash, method: settleMethod, reason: trimmedReason });
            setDone((prev) => ({ ...prev, [loan.id]: result }));
            setPending((prev) => {
               const next = { ...prev };
               delete next[loan.id];
               return next;
            });
            setTarget(null);
            setNotice(
               `Refunded ${money(principal(loan))} to ${loan.lender?.username ?? 'the lender'} · loan ${loan.tracking_id} closed · borrower banned.` +
                  (result.errors.length ? ` Follow-up issues: ${result.errors.join('; ')}` : '')
            );
            void load(!hideTest); // refresh from server so the row (now Paid) is gone for good
            return true;
         } catch (err) {
            // Money already left the wallet. Keep the hash so the admin can retry RECORDING only.
            setPending((prev) => ({ ...prev, [loan.id]: { hash, method: settleMethod, reason: trimmedReason } }));
            setError(
               `${err instanceof Error ? err.message : 'Could not record the refund.'} ` +
                  `The on-chain transfer (${hash}) already went out — use “Finish recording” to complete it WITHOUT sending again.`
            );
            return false;
         } finally {
            setStep('idle');
         }
      },
      [load, hideTest]
   );

   const handleRefund = useCallback(async () => {
      if (!target) return;
      const loan = target;

      // If a send already succeeded for this loan but recording failed, retry recording only.
      const pendingRecord = pending[loan.id];
      if (pendingRecord) {
         await record(loan, pendingRecord.hash, pendingRecord.method, pendingRecord.reason);
         return;
      }

      // Hard guard: refuse a second send for a loan we've already paid this session.
      if (sendInitiated.current.has(loan.id)) {
         setError('A refund payment was already sent for this loan in this session. Refresh before trying again.');
         return;
      }

      const lenderWallet = loan.lender?.wallet_address;
      if (!lenderWallet) {
         setError('This lender has no wallet on file — cannot send a refund.');
         return;
      }
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
         setError('Please enter a reason for the refund.');
         return;
      }
      const amount = principal(loan);
      setError(null);

      // Pre-send guard: re-check the loan's LIVE state so a stale row can't double-pay a loan that
      // was already refunded (e.g. in another tab, or a moment ago).
      setStep('checking');
      try {
         const state = await getLoanRefundState(loan.id);
         if (state.alreadyHandled) {
            setDone((prev) => ({ ...prev, [loan.id]: {} as RefundLoanResult }));
            setTarget(null);
            setNotice(`Loan ${loan.tracking_id} is already settled/refunded — no payment sent.`);
            void load(!hideTest);
            setStep('idle');
            return;
         }
      } catch (err) {
         setError(err instanceof Error ? err.message : 'Could not verify the loan state — not sending.');
         setStep('idle');
         return;
      }

      // 1) Send USDC from the admin's wallet to the lender. Mark the loan as send-initiated FIRST so
      //    even a double-fire of this handler can't produce a second transfer.
      sendInitiated.current.add(loan.id);
      setStep('sending');
      let outcome: { hash: string } | null = null;
      try {
         outcome = await payUsdc({ method, to: lenderWallet, usdAmount: String(amount), loanId: loan.id, coin: loan.coin ?? 'USDC' });
      } catch (err) {
         sendInitiated.current.delete(loan.id); // send never happened → allow a retry
         setError(err instanceof Error ? err.message : 'The wallet transfer failed.');
         setStep('idle');
         return;
      }
      if (!outcome) {
         // payUsdc self-toasts on rejection/failure and returns null → no money moved.
         sendInitiated.current.delete(loan.id);
         setStep('idle');
         return;
      }

      // 2) Record it (verify + cancel + ban + notify).
      await record(loan, outcome.hash, toSettlementMethod(method), trimmedReason);
   }, [target, reason, method, payUsdc, pending, record, load, hideTest]);

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
            Refund a lender their principal out of your own wallet ({method}). This closes the loan (no longer due) and{' '}
            <span className="text-red-300">bans + KYC-blacklists the borrower</span>. Each loan can only be paid once per
            session; refunded loans drop off the list. These actions are hard to undo.
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

         {notice ? (
            <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-4 text-base font-bold text-emerald-300">{notice}</div>
         ) : null}
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
                     {shown.map((l) => {
                        const isPending = Boolean(pending[l.id]);
                        const isSent = sendInitiated.current.has(l.id) && !isPending;
                        return (
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
                                    disabled={!l.lender?.wallet_address || isSent}
                                    className={`rounded-full px-4 py-1.5 text-xs font-black uppercase text-white disabled:opacity-50 ${isPending ? 'bg-amber-700' : 'bg-[#8336f0]'}`}
                                    title={
                                       isPending
                                          ? 'Payment already sent — finish recording without paying again'
                                          : isSent
                                            ? 'A refund was already sent for this loan this session'
                                            : l.lender?.wallet_address
                                              ? 'Refund this lender and ban the borrower'
                                              : 'Lender has no wallet on file'
                                    }
                                 >
                                    {isPending ? 'Finish recording' : isSent ? 'Sent — refresh' : 'Refund lender'}
                                 </button>
                              </td>
                           </tr>
                        );
                     })}
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
               <div className="w-full max-w-lg space-y-4 rounded-2xl border border-[#3d1f6e] bg-[#150730] p-6" onClick={(e) => e.stopPropagation()}>
                  <h4 className="text-2xl font-black text-white">{pending[target.id] ? 'Finish recording refund' : 'Confirm refund'}</h4>
                  {pending[target.id] ? (
                     <div className="rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-sm font-bold text-amber-200">
                        The USDC for this loan was already sent (tx {pending[target.id].hash.slice(0, 10)}…). This will record the
                        refund and ban the borrower <span className="font-black">without sending any more money</span>.
                     </div>
                  ) : null}
                  <div className="space-y-2 rounded-xl border border-[#2a1453] bg-[#1c0a3a] p-4 text-sm font-bold text-[#cfc6dd]">
                     <div className="flex justify-between gap-4">
                        <span className="text-[#a89bb8]">{pending[target.id] ? 'Amount (already sent)' : 'Send'}</span>
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
                        <span className="font-black">banned and KYC-blacklisted</span>, and this loan closed as no longer due.
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
                        {step === 'checking'
                           ? 'Checking…'
                           : step === 'sending'
                             ? 'Sending USDC…'
                             : step === 'recording'
                               ? 'Recording…'
                               : pending[target.id]
                                 ? 'Finish recording (no new payment)'
                                 : `Send ${money(principal(target))} & refund`}
                     </button>
                  </div>
               </div>
            </div>
         ) : null}
      </div>
   );
}
