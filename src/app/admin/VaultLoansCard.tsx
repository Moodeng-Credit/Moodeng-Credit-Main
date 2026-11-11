'use client';

import { useCallback, useEffect, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

import { useAdminLiveReload } from '@/app/admin/useAdminLive';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { txExplorerUrl } from '@/lib/txExplorer';
import { BITREPO_VAULT_URL, readVaultLoan, readVaultStatus, repayVaultLoan, type VaultLoan } from '@/lib/web3/bitrepoVault';

// Admin → Finance → Credit line: loans drawn from the BitRepo vault. Borrowers repay our lending wallet as with
// any loan; "Pay vault" then sends what they paid on to the vault (its interest and principal first, the rest
// to our cover), from the same wallet that drew it.

interface VaultLoanRow {
   id: string;
   tracking_id: string | null;
   loan_amount: number;
   total_repayment_amount: number;
   repaid_amount: number | null;
   repayment_status: string | null;
   due_date: string | null;
   lender_wallet: string | null;
}

const usdc = (base: bigint) => (Number(base) / 1e6).toFixed(2);
const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');

export default function VaultLoansCard() {
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();
   const [rows, setRows] = useState<VaultLoanRow[]>([]);
   const [onchain, setOnchain] = useState<Record<string, VaultLoan>>({});
   const [available, setAvailable] = useState<bigint | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [payingId, setPayingId] = useState<string | null>(null);
   const [paidTx, setPaidTx] = useState<Record<string, string>>({});

   const load = useCallback(async () => {
      setError(null);
      const { data, error: dbError } = await getSupabaseBrowserClient()
         .from('loans')
         .select('id, tracking_id, loan_amount, total_repayment_amount, repaid_amount, repayment_status, due_date, lender_wallet')
         .not('vault_address', 'is', null)
         .order('funded_at', { ascending: false });
      if (dbError) {
         setError(dbError.message);
         return;
      }
      const list = (data ?? []) as VaultLoanRow[];
      setRows(list);
      try {
         const [status, ...loans] = await Promise.all([readVaultStatus(), ...list.map((r) => readVaultLoan(r.id))]);
         setAvailable(status.availableToDraw);
         setOnchain(Object.fromEntries(list.map((r, i) => [r.id, loans[i]])));
      } catch {
         setError('Couldn’t read the vault on Base. Try again in a moment.');
      }
   }, []);

   useEffect(() => {
      void load();
   }, [load]);
   useAdminLiveReload(['loans'], load);

   const pay = async (row: VaultLoanRow, amount: bigint) => {
      if (!address) return;
      setPayingId(row.id);
      setError(null);
      try {
         const tx = await repayVaultLoan(address, row.id, amount);
         setPaidTx((prev) => ({ ...prev, [row.id]: tx }));
         await load();
      } catch (err) {
         setError((err as Error).message || 'The vault payment didn’t go through. Nothing was sent.');
      } finally {
         setPayingId(null);
      }
   };

   const out = rows.reduce((sum, r) => sum + (onchain[r.id]?.principal ?? 0n), 0n);

   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4">
         <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold text-white">BitRepo vault</h3>
            <a className="text-sm text-[#b99cff] underline" href={BITREPO_VAULT_URL} rel="noreferrer" target="_blank">
               Open on BitRepo
            </a>
         </div>
         <p className="mt-1 text-sm text-[#a89bb8]">
            Available to draw: <span className="text-white">{available == null ? '…' : `${usdc(available)} USDC`}</span>
            {' · '}Out from the vault: <span className="text-white">{usdc(out)} USDC</span>
            {' · '}Wallet:{' '}
            {address ? (
               <span className="font-mono text-white">{short(address)}</span>
            ) : (
               <button className="text-[#b99cff] underline" onClick={() => openConnectModal?.()} type="button">
                  connect
               </button>
            )}
         </p>

         {error ? <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : null}

         {rows.length === 0 ? (
            <p className="mt-3 text-sm text-[#a89bb8]">No loans drawn from the vault yet. Fund a request with “Vault Lend”.</p>
         ) : (
            <div className="mt-3 overflow-x-auto">
               <table className="w-full text-left text-sm">
                  <thead className="text-[#a89bb8]">
                     <tr>
                        <th className="py-1 pr-3">Loan</th>
                        <th className="py-1 pr-3">Due</th>
                        <th className="py-1 pr-3">Borrower paid us</th>
                        <th className="py-1 pr-3">Vault is owed</th>
                        <th className="py-1" />
                     </tr>
                  </thead>
                  <tbody className="text-white">
                     {rows.map((row) => {
                        const v = onchain[row.id];
                        const paidUs = Number(row.repaid_amount ?? 0);
                        const paidUsBase = BigInt(Math.round(paidUs * 1e6));
                        // What's still to pass on: what the borrower paid, less what the vault already took for this loan.
                        const passedOn = v ? BigInt(Math.round(Number(row.total_repayment_amount) * 1e6)) - v.totalDueLeft : 0n;
                        const toPay = v ? [paidUsBase - (passedOn > 0n ? passedOn : 0n), v.payoff].reduce((a, b) => (a < b ? a : b)) : 0n;
                        const settled = v ? v.principal === 0n && v.totalDueLeft === 0n : false;
                        const wrongWallet = Boolean(
                           address && row.lender_wallet && address.toLowerCase() !== row.lender_wallet.toLowerCase()
                        );
                        return (
                           <tr className="border-t border-[#2a1453]" key={row.id}>
                              <td className="py-2 pr-3">{row.tracking_id ?? row.id.slice(0, 8)}</td>
                              <td className="py-2 pr-3">
                                 {row.due_date ? row.due_date.slice(0, 10) : '—'}
                                 {v?.pastDue ? <span className="ml-1 text-amber-300">late</span> : null}
                              </td>
                              <td className="py-2 pr-3">
                                 ${paidUs.toFixed(2)} / ${Number(row.total_repayment_amount).toFixed(2)}
                              </td>
                              <td className="py-2 pr-3">{v ? (settled ? 'paid off' : `${usdc(v.payoff)} USDC`) : '…'}</td>
                              <td className="py-2 text-right">
                                 {paidTx[row.id] ? (
                                    <a
                                       className="text-xs text-emerald-300 underline"
                                       href={txExplorerUrl(paidTx[row.id])}
                                       rel="noreferrer"
                                       target="_blank"
                                    >
                                       Paid ✓
                                    </a>
                                 ) : settled || toPay <= 0n ? null : !address ? (
                                    <span className="text-xs text-[#a89bb8]">connect wallet</span>
                                 ) : wrongWallet ? (
                                    <span className="text-xs text-amber-300">use {short(row.lender_wallet)}</span>
                                 ) : (
                                    <button
                                       className="rounded-lg bg-[#6d3cff] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                                       disabled={payingId !== null}
                                       onClick={() => void pay(row, toPay)}
                                       type="button"
                                    >
                                       {payingId === row.id ? 'Paying…' : `Pay vault ${usdc(toPay)}`}
                                    </button>
                                 )}
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         )}
      </div>
   );
}
