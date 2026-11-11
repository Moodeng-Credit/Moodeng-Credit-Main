'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

import { addLedgerEntry } from '@/app/admin/adminFinance';
import {
   type CreditFacility,
   type FacilityLedgerRow,
   type FacilityLoan,
   directReturnsToRecord,
   facilityReturnDue,
   splitReturn
} from '@/app/admin/creditLineModel';
import { txExplorerUrl } from '@/lib/txExplorer';
import { BITREPO_RETURN_ADDRESS, type BitrepoTransfer, listTransfersToBitrepo, sendUsdcToBitrepo } from '@/lib/web3/bitrepoReturn';

// Admin → Finance → Credit line: money from the BitRepo advance (the older loans, lent from our lending
// wallet) goes back to BitRepo's wallet as those loans are repaid. Shows what is due now, sends it in one
// transfer from the lending wallet, and writes it to the ledger. Transfers already sent by hand are found
// on Base and can be recorded with one click. Vault loans are not part of this: they have "Pay vault".

const usd = (n: number) => `$${n.toFixed(2)}`;
const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
const TO_LABEL = `BitRepo ${short(BITREPO_RETURN_ADDRESS)}`;

interface Props {
   facility: CreditFacility;
   loans: FacilityLoan[];
   ledger: FacilityLedgerRow[];
   onChanged: () => Promise<void>;
}

export default function BitrepoReturnCard({ facility, loans, ledger, onChanged }: Props) {
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();
   const [onchain, setOnchain] = useState<BitrepoTransfer[]>([]);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const [sentTx, setSentTx] = useState<string | null>(null);

   const lendingWallet = facility.lending_wallet;
   const due = useMemo(() => facilityReturnDue(facility, loans, ledger), [facility, loans, ledger]);

   const findTransfers = useCallback(async () => {
      if (!lendingWallet) return;
      try {
         setOnchain(await listTransfersToBitrepo(lendingWallet));
      } catch {
         setError('Couldn’t check Base for transfers already sent. Try again in a moment.');
      }
   }, [lendingWallet]);

   useEffect(() => {
      void findTransfers();
   }, [findTransfers]);

   const recorded = useMemo(() => new Set(ledger.map((row) => row.tx_hash?.toLowerCase()).filter(Boolean)), [ledger]);
   // Two kinds waiting to be written to the ledger, oldest first: transfers sent from the lending wallet,
   // and repayments borrowers paid straight to BitRepo (their loans point at BitRepo's address).
   const unrecorded = useMemo(
      () =>
         [
            ...onchain
               .filter((t) => !recorded.has(t.hash.toLowerCase()))
               .map((t) => ({ key: t.hash, label: 'Sent from the lending wallet', amount: t.amount, at: t.at, tx: t.hash as string | null, loanId: null as string | null })),
            ...directReturnsToRecord(loans, ledger, BITREPO_RETURN_ADDRESS).map((r) => ({
               key: r.loanId,
               label: `Repaid straight to BitRepo · ${r.trackingId}`,
               amount: r.amount,
               at: r.at,
               tx: r.tx,
               loanId: r.loanId as string | null
            }))
         ].sort((a, b) => a.at.localeCompare(b.at)),
      [onchain, recorded, loans, ledger]
   );

   // One transfer → an interest row (first, up to what is due) and a principal row, both with its tx.
   const record = async (tx: string | null, amount: number, at: string, loanId: string | null = null) => {
      const { interest, principal } = splitReturn(amount, due.interestDue);
      const base = {
         facility_id: facility.id,
         occurred_at: at,
         to_label: TO_LABEL,
         from_label: loanId ? 'Borrower (paid BitRepo directly)' : 'Lending wallet',
         tx_hash: tx,
         loan_id: loanId
      };
      if (interest > 0)
         await addLedgerEntry({ ...base, kind: 'interest_payment', description: 'Interest paid to BitRepo', amount_usd: -interest });
      if (principal > 0)
         await addLedgerEntry({ ...base, kind: 'principal_return', description: 'Principal returned to BitRepo', amount_usd: -principal });
      await onChanged();
   };

   const run = async (fn: () => Promise<void>, fallback: string) => {
      setBusy(true);
      setError(null);
      try {
         await fn();
      } catch (err) {
         setError((err as { shortMessage?: string; message?: string })?.shortMessage || (err as Error)?.message || fallback);
      } finally {
         setBusy(false);
      }
   };

   const send = () =>
      run(async () => {
         const amount = due.total;
         if (!window.confirm(`Send ${usd(amount)} USDC to BitRepo?\n\n${BITREPO_RETURN_ADDRESS}`)) return;
         const tx = await sendUsdcToBitrepo(BigInt(Math.round(amount * 100)) * 10_000n);
         setSentTx(tx);
         // If saving fails here, the transfer still shows below as "sent, not recorded yet".
         await record(tx, amount, new Date().toISOString());
         await findTransfers();
      }, 'The transfer didn’t go through. Nothing was sent.');

   const wrongWallet = Boolean(address && lendingWallet && address.toLowerCase() !== lendingWallet.toLowerCase());

   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4">
         <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-bold text-white">Send back to BitRepo</h3>
            <a
               className="font-mono text-xs text-[#b99cff] underline"
               href={`https://basescan.org/address/${BITREPO_RETURN_ADDRESS}`}
               rel="noreferrer"
               target="_blank"
            >
               {BITREPO_RETURN_ADDRESS}
            </a>
         </div>
         <p className="mt-1 text-sm text-[#a89bb8]">
            Older loans lent from the advance (not the vault). Their borrowers now repay BitRepo directly; record each repayment here, and send the rest yourself.
         </p>

         <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
               <p className="text-sm text-[#a89bb8]">To send now</p>
               <p className={`text-2xl font-black ${due.total > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{usd(due.total)}</p>
            </div>
            <p className="text-sm text-[#a89bb8]">
               Principal <span className="text-white">{usd(due.principalDue)}</span>
               {' · '}Interest ({(facility.annual_rate * 100).toFixed(0)}%/yr) <span className="text-white">{usd(due.interestDue)}</span>
               <br />
               Already sent <span className="text-white">{usd(due.principalReturned + due.interestPaid)}</span>
               {' · '}Still out with borrowers <span className="text-white">{usd(due.stillOut)}</span> ({due.openLoans} {due.openLoans === 1 ? 'loan' : 'loans'})
            </p>
            <div className="ml-auto">
               {due.total <= 0 ? (
                  <span className="text-sm text-emerald-300">Nothing to send ✓</span>
               ) : unrecorded.length ? (
                  <span className="text-sm text-amber-300">Record the transfers below first</span>
               ) : !address ? (
                  <button className="rounded-lg bg-[#6d3cff] px-4 py-2 text-sm font-semibold text-white" onClick={() => openConnectModal?.()} type="button">
                     Connect wallet
                  </button>
               ) : wrongWallet ? (
                  <span className="text-sm text-amber-300">Use the lending wallet {short(lendingWallet)}</span>
               ) : (
                  <button
                     className="rounded-lg bg-[#6d3cff] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                     disabled={busy}
                     onClick={() => void send()}
                     type="button"
                  >
                     {busy ? 'Sending…' : `Send ${usd(due.total)} to BitRepo`}
                  </button>
               )}
            </div>
         </div>

         {error ? <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : null}
         {sentTx ? (
            <a className="mt-2 inline-block text-sm text-emerald-300 underline" href={txExplorerUrl(sentTx)} rel="noreferrer" target="_blank">
               Sent ✓ see the transfer
            </a>
         ) : null}

         {unrecorded.length ? (
            <div className="mt-3 border-t border-[#2a1453] pt-3">
               <p className="text-sm text-white">Paid to BitRepo, not recorded yet</p>
               <ul className="mt-1 space-y-1 text-sm">
                  {unrecorded.map((t, i) => (
                     <li className="flex flex-wrap items-center gap-3" key={t.key}>
                        <span className="text-white">{usd(t.amount)}</span>
                        <span className="text-[#a89bb8]">{t.label}</span>
                        <span className="text-[#a89bb8]">
                           {new Date(t.at).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        {t.tx ? (
                           <a className="font-mono text-xs text-[#b99cff] underline" href={txExplorerUrl(t.tx)} rel="noreferrer" target="_blank">
                              {short(t.tx)}
                           </a>
                        ) : null}
                        {/* Oldest first, so each one is split against what was due before the next. */}
                        {i === 0 ? (
                           <button
                              className="rounded-lg bg-[#6d3cff] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                              disabled={busy}
                              onClick={() => void run(() => record(t.tx, t.amount, t.at, t.loanId), 'Could not save it. Try again.')}
                              type="button"
                           >
                              Record
                           </button>
                        ) : null}
                     </li>
                  ))}
               </ul>
            </div>
         ) : null}
      </div>
   );
}
