// "Can't pick Base?" — Stableyard deposit addresses on other networks (Tron, BNB, Solana, …).
// Whatever the borrower sends there is converted and settled as USDC on Base into their own
// Moodeng wallet, where the repay page's balance watcher picks it up. Moodeng stays Base-only:
// this card never changes where repayments go, it only fixes "my exchange doesn't offer Base".
// TEST-ONLY for now: rendered in Admin → Test lab, not on the repay page (the function also refuses
// non-admins until STABLEYARD_DEPOSITS_PUBLIC=true).
// Backend: supabase/functions/stableyard-deposit-address (addresses + recent deposits).
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Check, ChevronDown, Copy, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import PoweredByStableyard from '@/components/brand/PoweredByStableyard';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type AddressAsset = { symbol: string; tokenAddress: string; decimals: number; minimum: string | null };
type DepositAddress = {
   id: string;
   chain_id: number;
   network_code: string | null;
   chain_family: string | null;
   address: string;
   assets: AddressAsset[];
};
type Deposit = {
   id: string;
   status: string;
   source_chain_id: number | null;
   asset_symbol: string | null;
   asset_decimals: number | null;
   amount_atomic: string | null;
   net_amount_atomic: string | null;
   net_asset_symbol: string | null;
   net_asset_decimals: number | null;
   created_at: string;
};
type DepositResponse = { enabled: boolean; code?: string; error?: string; addresses: DepositAddress[]; deposits: Deposit[] };

const NETWORK_LABELS: Record<number, string> = {
   728126428: 'Tron (TRC20)',
   56: 'BNB Chain (BEP20)',
   10103: 'Solana',
   42161: 'Arbitrum',
   137: 'Polygon',
   1: 'Ethereum (ERC20)',
   43114: 'Avalanche'
};

const networkLabel = (address: { chain_id: number; network_code: string | null }) =>
   NETWORK_LABELS[address.chain_id] ?? address.network_code ?? `Chain ${address.chain_id}`;

const formatAtomic = (atomic: string | null, decimals: number | null) => {
   if (!atomic || decimals === null || !/^\d+$/.test(atomic)) return '';
   const padded = atomic.padStart(decimals + 1, '0');
   const whole = padded.slice(0, padded.length - decimals);
   const fraction = decimals ? padded.slice(-decimals).replace(/0+$/, '').slice(0, 2) : '';
   return `${whole}${fraction ? `.${fraction}` : ''}`;
};

const DEPOSIT_STATUS: Record<string, { label: string; tone: 'wait' | 'done' | 'bad' }> = {
   detected: { label: 'Received, confirming', tone: 'wait' },
   confirming: { label: 'Received, confirming', tone: 'wait' },
   settling: { label: 'Converting to USDC on Base', tone: 'wait' },
   settled: { label: 'In your wallet', tone: 'done' },
   ignored: { label: 'Below the minimum, not converted', tone: 'bad' },
   requires_intervention: { label: 'Under review by our team', tone: 'bad' },
   failed: { label: 'Failed — contact us', tone: 'bad' },
   reversed: { label: 'Reversed — contact us', tone: 'bad' }
};

const copyText = async (text: string) => {
   try {
      if (navigator.clipboard?.writeText) {
         await navigator.clipboard.writeText(text);
         return true;
      }
   } catch {
      // fall through to the legacy path (in-app browsers, iframes)
   }
   try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
   } catch {
      return false;
   }
};

export default function AnyNetworkDeposit() {
   const [open, setOpen] = useState(false);
   const [loading, setLoading] = useState(false);
   const [data, setData] = useState<DepositResponse | null>(null);
   const [error, setError] = useState<string | null>(null);
   const [selectedChain, setSelectedChain] = useState<number | null>(null);
   const [copied, setCopied] = useState(false);

   const load = useCallback(async (refresh: boolean) => {
      setLoading(true);
      setError(null);
      const { data: body, error: invokeError } = await getSupabaseBrowserClient().functions.invoke('stableyard-deposit-address', {
         body: { refresh }
      });
      let next = body as DepositResponse | null;
      if (invokeError) {
         const context = (invokeError as { context?: { json?: () => Promise<DepositResponse> } }).context;
         next = (await context?.json?.().catch(() => null)) ?? null;
      }
      setLoading(false);
      if (!next) {
         setError('Could not load deposit addresses. Try again in a minute.');
         return;
      }
      setData(next);
      if (next.error) setError(next.code === 'no_wallet' ? 'Set up your Moodeng wallet first, then come back here.' : next.error);
      setSelectedChain((current) => current ?? next?.addresses[0]?.chain_id ?? null);
   }, []);

   useEffect(() => {
      if (open && !data && !loading) void load(false);
   }, [open, data, loading, load]);

   // While a deposit is on its way, re-check every 30s so "Converting…" flips to "In your wallet".
   const inFlight = useMemo(() => (data?.deposits ?? []).some((deposit) => DEPOSIT_STATUS[deposit.status]?.tone === 'wait'), [data]);
   useEffect(() => {
      if (!open || !inFlight) return;
      const timer = window.setInterval(() => void load(true), 30_000);
      return () => window.clearInterval(timer);
   }, [open, inFlight, load]);

   const selected = data?.addresses.find((address) => address.chain_id === selectedChain) ?? data?.addresses[0] ?? null;

   const handleCopy = async () => {
      if (!selected) return;
      if (await copyText(selected.address)) {
         setCopied(true);
         window.setTimeout(() => setCopied(false), 1800);
      }
   };

   // Nothing to offer (Stableyard not configured or switched off): render nothing at all.
   if (data && !data.enabled) return null;

   return (
      <div className="mt-3 rounded-2xl bg-white ring-1 ring-[#e4e0f0] dark:bg-[#1e1233] dark:ring-[#3a2a55]">
         <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
         >
            <span>
               <span className="block text-[13px] font-bold text-[#1a1240] dark:text-white">My exchange doesn't offer Base</span>
               <span className="block text-[12px] text-[#6b6090] dark:text-[#a095c8]">
                  Send USDT or USDC on Tron, BNB, Solana and more — it arrives as USDC on Base.
               </span>
            </span>
            <ChevronDown
               className={`h-5 w-5 shrink-0 text-[#6b6090] transition-transform ${open ? 'rotate-180' : ''}`}
               aria-hidden="true"
            />
         </button>

         {open ? (
            <div className="space-y-3 border-t border-[#efeaf8] px-4 pb-4 pt-3 dark:border-[#3a2a55]">
               {loading && !data ? (
                  <p className="text-[13px] text-[#6b6090] dark:text-[#a095c8]">Setting up your deposit addresses…</p>
               ) : null}
               {error ? (
                  <p className="rounded-xl bg-[#fef2f2] p-3 text-[13px] font-medium text-[#b91c1c] dark:bg-[#3a1414] dark:text-[#fca5a5]">
                     {error}
                  </p>
               ) : null}

               {data && data.addresses.length > 0 ? (
                  <>
                     <div>
                        <p className="mb-2 text-[12px] font-semibold text-[#1a1240] dark:text-white">
                           1. Pick the network your exchange shows
                        </p>
                        <div className="flex flex-wrap gap-2">
                           {data.addresses.map((address) => {
                              const active = address.chain_id === selected?.chain_id;
                              return (
                                 <button
                                    key={address.id}
                                    type="button"
                                    onClick={() => setSelectedChain(address.chain_id)}
                                    aria-pressed={active}
                                    className={`min-h-[36px] rounded-full px-3 text-[12px] font-semibold ring-1 ${
                                       active
                                          ? 'bg-[#6010D2] text-white ring-[#6010D2]'
                                          : 'bg-[#f5f4fa] text-[#1a1240] ring-[#e4e0f0] dark:bg-[#2a1740] dark:text-white dark:ring-[#3a2a55]'
                                    }`}
                                 >
                                    {networkLabel(address)}
                                 </button>
                              );
                           })}
                        </div>
                     </div>

                     {selected ? (
                        <div>
                           <p className="mb-2 text-[12px] font-semibold text-[#1a1240] dark:text-white">
                              2. Send {selected.assets.map((asset) => asset.symbol).join(' or ')} on {networkLabel(selected)} to this
                              address
                           </p>
                           <div className="flex gap-3 rounded-2xl bg-[#f5f4fa] p-3 dark:bg-[#2a1740]">
                              <div className="shrink-0 rounded-lg bg-white p-1.5">
                                 <QRCodeSVG value={selected.address} size={84} />
                              </div>
                              <div className="min-w-0 flex-1">
                                 <p className="break-all font-mono text-[12px] font-semibold leading-snug text-[#1a1240] dark:text-white">
                                    {selected.address}
                                 </p>
                                 <button
                                    type="button"
                                    onClick={handleCopy}
                                    className={`mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-white ${copied ? 'bg-[#16a34a]' : 'bg-[#6010D2]'}`}
                                 >
                                    {copied ? (
                                       <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                    ) : (
                                       <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                    )}
                                    {copied ? 'Copied!' : 'Copy address'}
                                 </button>
                              </div>
                           </div>
                           <ul className="mt-2 space-y-1 text-[12px] text-[#6b6090] dark:text-[#a095c8]">
                              {selected.assets.some((asset) => asset.minimum) ? (
                                 <li>
                                    Minimum:{' '}
                                    {selected.assets
                                       .filter((asset) => asset.minimum)
                                       .map((asset) => `${asset.minimum} ${asset.symbol}`)
                                       .join(', ')}
                                    . Smaller amounts are not converted.
                                 </li>
                              ) : null}
                              <li>Only send on {networkLabel(selected)} to this address. This address is yours and can be reused.</li>
                              <li>
                                 It arrives in your Moodeng wallet as USDC on Base, minus a small conversion fee, usually within a few
                                 minutes.
                              </li>
                           </ul>
                        </div>
                     ) : null}

                     {data.deposits.length > 0 ? (
                        <div>
                           <div className="mb-1.5 flex items-center justify-between">
                              <p className="text-[12px] font-semibold text-[#1a1240] dark:text-white">Your recent deposits</p>
                              <button
                                 type="button"
                                 onClick={() => void load(true)}
                                 disabled={loading}
                                 className="inline-flex min-h-[32px] items-center gap-1 text-[12px] font-semibold text-[#6010D2] disabled:opacity-50 dark:text-[#c4b5fd]"
                              >
                                 <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                                 Refresh
                              </button>
                           </div>
                           <ul className="space-y-1.5">
                              {data.deposits.map((deposit) => {
                                 const status = DEPOSIT_STATUS[deposit.status] ?? { label: deposit.status, tone: 'wait' as const };
                                 const sent = formatAtomic(deposit.amount_atomic, deposit.asset_decimals);
                                 const received = formatAtomic(deposit.net_amount_atomic, deposit.net_asset_decimals);
                                 return (
                                    <li
                                       key={deposit.id}
                                       className="flex items-center justify-between gap-2 rounded-xl bg-[#f5f4fa] px-3 py-2 text-[12px] dark:bg-[#2a1740]"
                                    >
                                       <span className="font-semibold text-[#1a1240] dark:text-white">
                                          {sent} {deposit.asset_symbol}
                                          {deposit.status === 'settled' && received
                                             ? ` → ${received} ${deposit.net_asset_symbol ?? 'USDC'}`
                                             : ''}
                                       </span>
                                       <span
                                          className={`text-right font-semibold ${
                                             status.tone === 'done'
                                                ? 'text-[#16a34a]'
                                                : status.tone === 'bad'
                                                  ? 'text-[#b91c1c] dark:text-[#fca5a5]'
                                                  : 'text-[#6b6090] dark:text-[#a095c8]'
                                          }`}
                                       >
                                          {status.tone === 'done' ? '✓ ' : status.tone === 'bad' ? '⚠ ' : '… '}
                                          {status.label}
                                       </span>
                                    </li>
                                 );
                              })}
                           </ul>
                        </div>
                     ) : null}
                  </>
               ) : null}

               <div className="flex justify-end">
                  <PoweredByStableyard />
               </div>
            </div>
         ) : null}
      </div>
   );
}
