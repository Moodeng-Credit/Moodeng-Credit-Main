import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';

import { type LocaleCode, useLocalization } from '@/i18n';

import { BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import { getBaseWalletLockStatus } from '@/lib/walletProvider';
import type { RootState } from '@/store/store';

// Recent money in/out for the borrower's instant wallet — the GCash-style transaction list
// that makes the balance believable ("my repayment went through", "the loan really landed").
// Reads USDC Transfer history straight from chain via Alchemy's transfers API (the same
// provisioned key the RPC transports use), newest first. Renders nothing when the key is
// missing or the fetch fails — the balance card stands alone fine.

type ActivityCopy = {
   title: string;
   moneyIn: string;
   moneyOut: string;
};

const ACTIVITY_COPY: Record<LocaleCode, ActivityCopy> = {
   en: { title: 'Recent activity', moneyIn: 'Money in', moneyOut: 'Money out' },
   fil: { title: 'Mga huling galaw', moneyIn: 'Pera papasok', moneyOut: 'Pera palabas' },
   id: { title: 'Aktivitas terbaru', moneyIn: 'Uang masuk', moneyOut: 'Uang keluar' },
   th: { title: 'รายการล่าสุด', moneyIn: 'เงินเข้า', moneyOut: 'เงินออก' },
   vi: { title: 'Hoạt động gần đây', moneyIn: 'Tiền vào', moneyOut: 'Tiền ra' }
};

const ALCHEMY_ID = import.meta.env.VITE_ALCHEMY_ID ?? '';
const MAX_ROWS = 5;

export type ActivityRow = {
   direction: 'in' | 'out';
   amount: number;
   timestamp: string; // ISO
   hash: string;
};

type AlchemyTransfer = {
   value: number | null;
   hash: string;
   metadata?: { blockTimestamp?: string };
};

async function fetchTransfers(address: string, direction: 'in' | 'out', signal: AbortSignal): Promise<ActivityRow[]> {
   const res = await fetch(`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
         id: 1,
         jsonrpc: '2.0',
         method: 'alchemy_getAssetTransfers',
         params: [
            {
               fromBlock: '0x0',
               toBlock: 'latest',
               [direction === 'in' ? 'toAddress' : 'fromAddress']: address,
               contractAddresses: [BASE_USDC_ADDRESS],
               category: ['erc20'],
               withMetadata: true,
               order: 'desc',
               maxCount: `0x${MAX_ROWS.toString(16)}`
            }
         ]
      })
   });
   if (!res.ok) throw new Error(`transfers ${res.status}`);
   const json = (await res.json()) as { result?: { transfers?: AlchemyTransfer[] } };
   return (json.result?.transfers ?? [])
      .filter((t) => typeof t.value === 'number' && t.value > 0)
      .map((t) => ({
         direction,
         amount: t.value as number,
         timestamp: t.metadata?.blockTimestamp ?? '',
         hash: t.hash
      }));
}

function formatWhen(iso: string, locale: string): string {
   if (!iso) return '';
   const d = new Date(iso);
   if (Number.isNaN(d.getTime())) return '';
   return d.toLocaleDateString(locale === 'fil' ? 'en-PH' : locale, { month: 'short', day: 'numeric' });
}

// DEV-only: the /account-wallet-preview harness feeds mock rows so the design is reviewable
// without a funded wallet. No effect in prod.
export default function WalletActivity({ previewRows }: { previewRows?: ActivityRow[] } = {}) {
   const { locale } = useLocalization();
   const user = useSelector((state: RootState) => state.auth.user);
   const [rows, setRows] = useState<ActivityRow[] | null>(previewRows ?? null);
   const [failed, setFailed] = useState(false);

   const walletLock = getBaseWalletLockStatus(user);
   const address = previewRows ? null : walletLock.address;
   const isInstant = previewRows ? true : walletLock.isConfirmedOpenfort;

   useEffect(() => {
      if (previewRows || !address || !isInstant || !ALCHEMY_ID) return;
      const controller = new AbortController();
      Promise.all([fetchTransfers(address, 'in', controller.signal), fetchTransfers(address, 'out', controller.signal)])
         .then(([incoming, outgoing]) => {
            const merged = [...incoming, ...outgoing]
               .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
               .slice(0, MAX_ROWS);
            setRows(merged);
         })
         .catch(() => setFailed(true));
      return () => controller.abort();
   }, [address, isInstant, previewRows]);

   // Quietly absent unless this is an instant wallet with something to show (or loading).
   if (!previewRows && (!address || !isInstant || !ALCHEMY_ID)) return null;
   // Nothing to show (loading, failed, or a brand-new wallet) → stay quietly absent;
   // the balance card's empty-state line already covers the fresh-wallet story.
   if (failed || rows == null || rows.length === 0) return null;

   const copy = ACTIVITY_COPY[locale];

   return (
      <div className="rounded-[16px] border border-md-neutral-400 bg-white dark:bg-md-neutral-200">
         <p className="px-md-4 pt-md-3 text-md-b2 font-medium text-md-neutral-700">{copy.title}</p>
         <ul className="flex flex-col">
            {rows.map((row) => (
               <li
                  key={`${row.hash}-${row.direction}`}
                  className="flex items-center justify-between gap-3 border-t border-md-neutral-300 px-md-4 py-md-3 first:border-t-0"
               >
                  <div className="flex items-center gap-3">
                     <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
                           row.direction === 'in' ? 'bg-md-green-100 text-md-green-900' : 'bg-[#f3effe] text-[#6c3fe0]'
                        }`}
                     >
                        {row.direction === 'in' ? '↓' : '↑'}
                     </span>
                     <div className="flex flex-col">
                        <span className="text-md-b2 font-semibold text-md-heading">
                           {row.direction === 'in' ? copy.moneyIn : copy.moneyOut}
                        </span>
                        <span className="text-md-b3 font-medium text-md-neutral-700">{formatWhen(row.timestamp, locale)}</span>
                     </div>
                  </div>
                  <span className={`text-md-b1 font-semibold ${row.direction === 'in' ? 'text-md-green-900' : 'text-md-heading'}`}>
                     {row.direction === 'in' ? '+' : '−'}
                     {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
               </li>
            ))}
         </ul>
      </div>
   );
}
