'use client';

import { useCallback, useEffect, useState } from 'react';

import { type AdminInterestRefund, listInterestRefunds, logAdminAction, setInterestRefundSent } from '@/app/admin/adminSupabase';

const personLabel = (p: { username: string | null; display_name: string | null } | null | undefined) =>
   p ? p.display_name?.trim() || (p.username ? `@${p.username}` : 'Unknown') : 'Deleted account';

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err));

const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

/**
 * "Pay zero interest" refunds: queued by the database once a borrower's invited friend has repaid a
 * loan (and they have a repaid loan with interest). The team sends the USDC by hand, then marks it here.
 */
export default function InterestRefundsSection() {
   const [refunds, setRefunds] = useState<AdminInterestRefund[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState<string | null>(null);
   const [showSent, setShowSent] = useState(false);
   const [txHashes, setTxHashes] = useState<Record<string, string>>({});

   const load = useCallback(async () => {
      setLoading(true);
      try {
         setRefunds(await listInterestRefunds());
         setError(null);
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setLoading(false);
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const markSent = useCallback(async (refund: AdminInterestRefund, txHash: string) => {
      const hash = txHash.trim();
      if (hash && !TX_HASH_PATTERN.test(hash)) {
         setError('That transaction hash looks wrong (0x + 64 characters). Leave it empty if you don’t have it.');
         return;
      }
      setBusy(refund.id);
      setError(null);
      try {
         const updated = await setInterestRefundSent(refund.id, hash || null, 'admin panel');
         await logAdminAction({
            action: 'interest_refund_sent',
            target_table: 'interest_refunds',
            target_id: refund.id,
            target_user_id: refund.user?.id ?? null,
            metadata: { amount_usd: refund.amount_usd, tx_hash: hash || null }
         });
         setRefunds((prev) => prev.map((row) => (row.id === refund.id ? updated : row)));
      } catch (err) {
         setError(errorMessage(err));
      } finally {
         setBusy(null);
      }
   }, []);

   const pending = refunds.filter((r) => r.status === 'pending');
   const shown = showSent ? refunds : pending;

   return (
      <article className="rounded-2xl border border-emerald-700/60 bg-[#1c0a3a] p-5">
         <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-xl font-black">
               Interest refunds owed <span className="text-base font-bold text-emerald-300">({pending.length} to send)</span>
            </h4>
            <button
               type="button"
               onClick={() => setShowSent((v) => !v)}
               className="rounded-full bg-[#241044] px-4 py-1.5 text-sm font-black text-[#a89bb8]"
            >
               {showSent ? 'Hide sent' : 'Show sent'}
            </button>
         </div>
         <p className="mt-1 text-sm font-medium text-[#a89bb8]">
            &quot;Pay zero interest&quot;: their invited friend repaid a loan, so we send back the interest on their latest repaid loan
            (max $5) in USDC on Base.
         </p>
         {error ? <p className="mt-2 text-sm font-bold text-red-300">{error}</p> : null}
         {shown.length ? (
            <ul className="mt-3 space-y-2">
               {shown.map((r) => (
                  <li
                     key={r.id}
                     className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ${r.status === 'pending' ? 'bg-emerald-950/40' : 'bg-[#241044]'}`}
                  >
                     <div className="min-w-0">
                        <p className="text-base font-black text-white">
                           {r.status === 'pending' ? '💸 ' : ''}
                           Send ${Number(r.amount_usd).toFixed(2)} to {personLabel(r.user)}{' '}
                           {r.status === 'sent' ? <span className="text-emerald-300">sent</span> : null}
                        </p>
                        <p className="break-all font-mono text-sm font-black text-[#cfc6dd]">{r.user?.wallet_address || 'No wallet on file'}</p>
                        <p className="text-sm font-medium text-[#a89bb8]">
                           friend {personLabel(r.friend?.referred)} repaid · their loan ${Number(r.loan?.loan_amount ?? 0).toFixed(2)} → $
                           {Number(r.loan?.total_repayment_amount ?? 0).toFixed(2)} (interest ${Number(r.interest_usd).toFixed(2)}) ·{' '}
                           {new Date(r.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok' })}
                           {r.status === 'sent' && r.sent_at
                              ? ` · sent ${new Date(r.sent_at).toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok' })}`
                              : ''}
                           {r.tx_hash ? ` · ${r.tx_hash.slice(0, 10)}…` : ''}
                        </p>
                     </div>
                     {r.status === 'pending' ? (
                        <div className="flex flex-wrap gap-2">
                           <input
                              value={txHashes[r.id] ?? ''}
                              onChange={(event) => setTxHashes((prev) => ({ ...prev, [r.id]: event.target.value }))}
                              placeholder="Tx hash (optional)"
                              className="w-44 rounded-xl bg-[#241044] px-3 py-2 font-mono text-sm text-white placeholder:text-[#6f6385]"
                           />
                           <button
                              type="button"
                              onClick={() => markSent(r, txHashes[r.id] ?? '')}
                              disabled={busy === r.id}
                              className="rounded-xl bg-[#8336f0] px-4 py-2 text-base font-black text-white disabled:opacity-50"
                           >
                              ✅ Sent
                           </button>
                        </div>
                     ) : null}
                  </li>
               ))}
            </ul>
         ) : (
            <p className="mt-2 text-base font-bold text-[#6f6385]">
               {loading ? 'Loading…' : 'Nothing to send right now. Refunds appear here once an invited friend repays a loan.'}
            </p>
         )}
      </article>
   );
}
