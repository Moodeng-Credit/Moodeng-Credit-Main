'use client';

import { useCallback, useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Indonesia track: Moodeng's Openfort payout wallet on BNB Smart Chain. Shows its address, USDC/BNB
 * balance, the auto-pay switch (read-only — flipped with /idautopay in the admin Telegram group) and
 * today's total vs the cap. admin-fund-loan payout_wallet_status / payout_wallet_create →
 * supabase/functions/_shared/idPayoutWallet.ts.
 */

export type PayoutWalletStatus = {
   configured: boolean;
   address: string | null;
   usdc: number | null;
   bnb: number | null;
   autopay: 'on' | 'off';
   maxUsd: number;
   dailyCapUsd: number;
   paidTodayUsd: number;
};

const invoke = async <T,>(body: Record<string, unknown>): Promise<{ data?: T; error?: string }> => {
   const { data, error } = await getSupabaseBrowserClient().functions.invoke('admin-fund-loan', { body });
   if (error) {
      const ctx = (error as { context?: Response }).context;
      const parsed =
         ctx && typeof ctx.clone === 'function'
            ? await ctx
                 .clone()
                 .json()
                 .catch(() => null)
            : null;
      return { error: (parsed as { error?: string } | null)?.error ?? error.message };
   }
   return { data: data as T };
};

export const fetchPayoutWalletStatus = () => invoke<PayoutWalletStatus>({ action: 'payout_wallet_status' });

const usd = (v: number | null) => (v == null ? '—' : `$${v.toFixed(2)}`);

export default function IdPayoutWalletPanel() {
   const [status, setStatus] = useState<PayoutWalletStatus | null>(null);
   const [loading, setLoading] = useState(true);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const [copied, setCopied] = useState(false);

   const load = useCallback(async () => {
      const res = await fetchPayoutWalletStatus();
      if (res.data) setStatus(res.data);
      setError(res.error ?? '');
      setLoading(false);
   }, []);

   useEffect(() => {
      void load();
   }, [load]);

   const create = async () => {
      if (busy) return;
      setBusy(true);
      const res = await invoke<{ ok: boolean; error?: string }>({ action: 'payout_wallet_create' });
      if (res.error || !res.data?.ok) setError(res.error ?? res.data?.error ?? 'Could not create the wallet.');
      await load();
      setBusy(false);
   };

   const copy = (value: string) => {
      void navigator.clipboard.writeText(value).then(
         () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
         },
         () => undefined
      );
   };

   const capLeft = status ? Math.max(0, status.dailyCapUsd - status.paidTodayUsd) : 0;
   const capPct = status && status.dailyCapUsd > 0 ? Math.min(100, (status.paidTodayUsd / status.dailyCapUsd) * 100) : 0;
   const low = status?.usdc != null && status.usdc < 20;

   // Support accounts can't use admin-fund-loan (owners/admins only): show nothing rather than an error.
   if (!status && error.startsWith('Forbidden')) return null;

   return (
      <section className="mt-10 rounded-3xl border border-[#2a1453] border-t-4 border-t-[#ce1126] bg-[#1c0a3a] p-6">
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
               <h2 className="text-2xl font-black">🇮🇩 Payout wallet (BNB Chain)</h2>
               <p className="mt-1 max-w-2xl text-base text-[#a89bb8]">
                  Indonesian loans are paid from here in USDC (BSC) to the borrower&apos;s Walt. Gas is sponsored by Openfort.
               </p>
            </div>
            {status ? (
               <span
                  className={`rounded-full px-3 py-1 text-sm font-black ${status.autopay === 'on' ? 'bg-[#1f7a3d] text-white' : 'bg-[#3a2560] text-[#d8cce8]'}`}
               >
                  Auto-pay {status.autopay === 'on' ? 'ON' : 'OFF'}
               </span>
            ) : null}
         </div>

         {loading ? <p className="mt-4 text-[#a89bb8]">Loading payout wallet…</p> : null}

         {!loading && status && !status.configured ? (
            <p className="mt-4 rounded-2xl bg-[#3a1420] px-4 py-3 font-semibold text-[#ffb4b4]">
               Openfort keys aren&apos;t set yet (vault secret <code>OPENFORT_PAYOUT</code>). Nothing is paid automatically until they are.
            </p>
         ) : null}

         {!loading && status && status.configured && !status.address ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
               <p className="text-[#d8cce8]">No payout wallet yet.</p>
               <button
                  type="button"
                  disabled={busy}
                  onClick={() => void create()}
                  className="rounded-xl px-4 py-2 text-base font-black text-[#4a2a00] disabled:opacity-60"
                  style={{ background: 'linear-gradient(180deg, #ffe27a 0%, #ffbe1a 100%)' }}
               >
                  {busy ? 'Creating…' : 'Create payout wallet'}
               </button>
            </div>
         ) : null}

         {status?.address ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
               <div className="rounded-2xl border border-[#2a1453] bg-[#241044] p-4">
                  <p className="text-sm font-black uppercase text-[#a89bb8]">Address (BEP20)</p>
                  <p className="mt-1 break-all font-mono text-base font-bold">{status.address}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                     <button
                        type="button"
                        onClick={() => copy(status.address ?? '')}
                        className="rounded-lg bg-white px-3 py-1 text-sm font-bold text-[#1b1c1d]"
                     >
                        {copied ? 'Copied ✓' : 'Copy'}
                     </button>
                     <a
                        href={`https://bscscan.com/address/${status.address}#tokentxns`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-[#a89bb8] px-3 py-1 text-sm font-bold text-[#d8cce8]"
                     >
                        BscScan
                     </a>
                  </div>
               </div>
               <div className="rounded-2xl border border-[#2a1453] bg-[#241044] p-4">
                  <p className="text-sm font-black uppercase text-[#a89bb8]">Balance</p>
                  <p className={`mt-1 text-3xl font-black ${low ? 'text-[#ff8080]' : ''}`}>{usd(status.usdc)} USDC</p>
                  <p className="text-sm text-[#a89bb8]">
                     {status.bnb == null ? '—' : `${status.bnb.toFixed(4)} BNB (info only, gas is sponsored)`}
                  </p>
                  {low ? <p className="mt-1 text-sm font-bold text-[#ff8080]">Low — top it up.</p> : null}
               </div>
               <div className="rounded-2xl border border-[#2a1453] bg-[#241044] p-4">
                  <p className="text-sm font-black uppercase text-[#a89bb8]">Paid automatically today</p>
                  <p className="mt-1 text-3xl font-black">
                     {usd(status.paidTodayUsd)} <span className="text-lg text-[#a89bb8]">/ ${status.dailyCapUsd}</span>
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#3a2560]">
                     <div className="h-full rounded-full bg-[#ffbe1a]" style={{ width: `${capPct}%` }} />
                  </div>
                  <p className="mt-1 text-sm text-[#a89bb8]">
                     ${capLeft.toFixed(2)} left today (Bangkok) · max ${status.maxUsd} per loan
                  </p>
               </div>
            </div>
         ) : null}

         {status?.address ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
               <div className="rounded-2xl border border-[#2a1453] bg-[#241044] p-4 text-base">
                  <p className="text-sm font-black uppercase text-[#a89bb8]">Top up</p>
                  <ol className="mt-1 ml-5 list-decimal leading-7">
                     <li>Binance TH → Withdraw → USDC</li>
                     <li>
                        Network: <b>BSC (BNB Smart Chain)</b>
                     </li>
                     <li>Paste this wallet&apos;s address (Copy above)</li>
                     <li>Send — the balance updates here in about a minute</li>
                  </ol>
               </div>
               <div className="rounded-2xl border border-[#2a1453] bg-[#241044] p-4 text-base">
                  <p className="text-sm font-black uppercase text-[#a89bb8]">Auto-pay switch</p>
                  <p className="mt-1">
                     {status.autopay === 'on'
                        ? 'ON: open Indonesian requests are paid from this wallet about 2 minutes after they’re posted.'
                        : 'OFF: pay each request with “Pay now” below, or by hand.'}
                  </p>
                  <p className="mt-1 text-[#a89bb8]">
                     Change it with <code>/idautopay on</code> or <code>/idautopay off</code> in the admin Telegram group.
                  </p>
               </div>
            </div>
         ) : null}

         {error ? <p className="mt-4 rounded-2xl bg-[#3a1420] px-4 py-3 font-semibold text-[#ffb4b4]">{error}</p> : null}
      </section>
   );
}
