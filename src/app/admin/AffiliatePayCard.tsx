'use client';

import { useCallback, useEffect, useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

import { listOwedAffiliates, markPayoutsPaid, type OwedAffiliate } from '@/app/admin/affiliatePayouts';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { txExplorerUrl } from '@/lib/txExplorer';
import { sendUsdc } from '@/lib/web3/sendUsdc';

const usd = (n: number) => `$${n.toFixed(2)}`;
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;
const errorText = (err: unknown, fallback: string) =>
   (err as { shortMessage?: string })?.shortMessage || (err as Error)?.message || fallback;

/**
 * Pay one affiliate everything they're owed: Send (USDC on Base from the connected wallet straight to
 * their Moodeng wallet, then every row is marked paid with the tx), or mark paid after sending by hand.
 */
export function AffiliatePayCard({ affiliate, onPaid }: { affiliate: OwedAffiliate; onPaid: () => void | Promise<void> }) {
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [sentTx, setSentTx] = useState<string | null>(null);
   const [handTx, setHandTx] = useState('');
   const [copied, setCopied] = useState(false);
   const wallet = affiliate.wallet_address;
   const name = affiliate.display_name?.trim() || (affiliate.username ? `@${affiliate.username}` : 'this person');

   const run = async (fn: () => Promise<void>, fallback: string) => {
      setBusy(true);
      setError(null);
      try {
         await fn();
      } catch (err) {
         setError(errorText(err, fallback));
      } finally {
         setBusy(false);
      }
   };

   const send = () =>
      run(async () => {
         if (!wallet) return;
         if (!window.confirm(`Send ${usd(affiliate.owed)} USDC on Base to ${name}?\n\n${wallet}`)) return;
         const tx = await sendUsdc(wallet, affiliate.owed);
         setSentTx(tx);
         // If saving fails, the money still went: the error says so and "Mark paid" below can record it.
         setHandTx(tx);
         await markPayoutsPaid(affiliate, affiliate.items, tx);
         await onPaid();
      }, 'The transfer didn’t go through. Nothing was sent.');

   const markByHand = () =>
      run(async () => {
         const hash = handTx.trim();
         if (hash && !TX_HASH_PATTERN.test(hash))
            throw new Error('That transaction hash looks wrong (0x + 64 characters). Leave it empty if you don’t have it.');
         if (!window.confirm(`Mark ${usd(affiliate.owed)} to ${name} as paid? Only do this if you already sent it.`)) return;
         await markPayoutsPaid(affiliate, affiliate.items, hash || null);
         await onPaid();
      }, 'Could not save it. Try again.');

   const copy = async () => {
      if (!wallet) return;
      try {
         await navigator.clipboard.writeText(wallet);
         setCopied(true);
         window.setTimeout(() => setCopied(false), 1500);
      } catch {
         window.prompt('Copy the wallet address', wallet);
      }
   };

   return (
      <div className="rounded-2xl border border-[#2a1453] bg-[#1a0838] p-4 text-white">
         <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
               <p className="truncate text-lg font-bold">{name}</p>
               {affiliate.username && affiliate.display_name ? <p className="text-sm text-[#a89bb8]">@{affiliate.username}</p> : null}
            </div>
            <p className="text-2xl font-black text-amber-300">{usd(affiliate.owed)}</p>
         </div>

         <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[#a89bb8]">Moodeng wallet (Base):</span>
            {wallet ? (
               <>
                  <a
                     className="font-mono text-[#b99cff] underline"
                     href={`https://basescan.org/address/${wallet}`}
                     rel="noreferrer"
                     target="_blank"
                  >
                     {short(wallet)}
                  </a>
                  <button type="button" onClick={() => void copy()} className="rounded-md bg-[#34234f] px-2 py-0.5 text-xs font-semibold">
                     {copied ? 'Copied ✓' : 'Copy'}
                  </button>
               </>
            ) : (
               <span className="text-amber-300">no wallet yet — they need to open the app once</span>
            )}
         </div>

         <ul className="mt-3 space-y-1 text-sm text-[#d8cfe6]">
            {affiliate.items.map((i) => (
               <li key={`${i.source}-${i.id}`} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                     {i.label}{' '}
                     <span className="text-[#8a7da0]">
                        · {new Date(i.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Bangkok' })}
                     </span>
                  </span>
                  <span className="shrink-0">{usd(i.amount)}</span>
               </li>
            ))}
         </ul>

         <div className="mt-4 flex flex-wrap items-center gap-2">
            {!wallet ? null : !address ? (
               <button type="button" onClick={() => openConnectModal?.()} className="rounded-xl bg-[#6d3cff] px-4 py-2 font-bold">
                  Connect wallet to pay
               </button>
            ) : (
               <button
                  type="button"
                  disabled={busy}
                  onClick={() => void send()}
                  className="rounded-xl bg-[#f5b400] px-4 py-2 font-black text-[#1a0838] disabled:opacity-50"
               >
                  {busy ? 'Sending…' : `💸 Pay ${usd(affiliate.owed)} USDC`}
               </button>
            )}
            {address ? <span className="text-xs text-[#8a7da0]">from {short(address)}</span> : null}
         </div>

         <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-[#a89bb8]">Already sent it by hand? Mark paid</summary>
            <div className="mt-2 flex flex-wrap gap-2">
               <input
                  value={handTx}
                  onChange={(e) => setHandTx(e.target.value)}
                  placeholder="Transaction hash (optional)"
                  className="min-w-0 flex-1 rounded-lg bg-[#241044] px-3 py-2 font-mono text-xs text-white"
               />
               <button
                  type="button"
                  disabled={busy}
                  onClick={() => void markByHand()}
                  className="rounded-lg bg-emerald-700 px-3 py-2 font-bold disabled:opacity-50"
               >
                  ✅ Mark paid
               </button>
            </div>
         </details>

         {error ? (
            <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
               {error}
               {sentTx ? ' The money was sent — use “Mark paid” with the hash above to record it.' : ''}
            </p>
         ) : null}
         {sentTx ? (
            <a
               className="mt-2 inline-block text-sm text-emerald-300 underline"
               href={txExplorerUrl(sentTx)}
               rel="noreferrer"
               target="_blank"
            >
               Sent ✓ see the transfer
            </a>
         ) : null}
      </div>
   );
}

/** Admin-only panel under someone's /affiliate dashboard: what we owe them, and the Pay button. */
export function AffiliatePayoutPanel({ userId }: { userId: string }) {
   const [owed, setOwed] = useState<OwedAffiliate | null>(null);
   const [wallet, setWallet] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   const load = useCallback(async () => {
      try {
         const [rows, user] = await Promise.all([
            listOwedAffiliates(userId),
            getSupabaseBrowserClient().from('users').select('wallet_address').eq('id', userId).maybeSingle()
         ]);
         setOwed(rows[0] ?? null);
         setWallet((user.data as { wallet_address: string | null } | null)?.wallet_address ?? null);
         setError(null);
      } catch (err) {
         setError(errorText(err, 'Could not load payouts.'));
      } finally {
         setLoading(false);
      }
   }, [userId]);

   useEffect(() => {
      void load();
   }, [load]);

   return (
      <section className="mt-6 rounded-2xl bg-[#12052a] p-4">
         <h2 className="mb-3 text-[15px] font-bold text-white">Admin · Pay out</h2>
         {loading ? <p className="text-sm text-[#a89bb8]">Loading…</p> : null}
         {error ? <p className="text-sm text-red-300">{error}</p> : null}
         {!loading && !error && owed ? <AffiliatePayCard affiliate={owed} onPaid={load} /> : null}
         {!loading && !error && !owed ? (
            <p className="text-sm text-[#a89bb8]">
               Nothing owed right now ✓
               {wallet ? (
                  <>
                     {' '}
                     · wallet <span className="break-all font-mono text-[#b99cff]">{wallet}</span>
                  </>
               ) : null}
            </p>
         ) : null}
      </section>
   );
}
