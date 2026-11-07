/**
 * Walt bridge (Indonesia track) — the app side of the `relay` actions in
 * supabase/functions/stableyard-deposit-address/relay.ts.
 *
 *   Cash-out: USDC on Base (Moodeng wallet) → Relay one-time address → USDC on BNB Chain → Walt.
 *   Repay:    USDT on BNB Chain (Walt) → Relay one-time address → USDC on Base → Moodeng wallet.
 *
 * The server always uses the addresses saved on the account (users.walt_address /
 * users.wallet_address); the app never sends a recipient.
 */
import { useEffect, useState } from 'react';

import { BSC_CHAIN_ID, BSC_USDC_ADDRESS } from '@/lib/idTrack';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const FN = 'stableyard-deposit-address';

export type RelayDirection = 'cashout' | 'repay';
/** relay_transfers.status: quoted → sent → pending → success | failure | refund (| expired). */
export type RelayRowStatus = 'quoted' | 'sent' | 'pending' | 'success' | 'failure' | 'refund' | 'expired';

export type RelayTransfer = {
   transferId: string;
   direction: RelayDirection;
   status: RelayRowStatus;
   depositAddress: string;
   recipient: string;
   /** Exact amount to send, human units ("20" / "15.3"). */
   amountIn: string;
   amountInUnits: string;
   amountOut: string | null;
   amountOutMin: string | null;
   feeUsd: number | null;
   timeEstimate: number | null;
   txHash: string | null;
   fillTxHash: string | null;
   createdAt: string;
};

type RelayResponse = Partial<RelayTransfer> & {
   ok?: boolean;
   code?: string;
   error?: string;
   waltAddress?: string | null;
   relayStatus?: string | null;
   transfer?: RelayTransfer | null;
};

export class RelayWaltError extends Error {
   readonly code: string;
   constructor(message: string, code: string) {
      super(message);
      this.name = 'RelayWaltError';
      this.code = code;
   }
}

const call = async (body: Record<string, unknown>): Promise<RelayResponse> => {
   const { data, error } = await getSupabaseBrowserClient().functions.invoke(FN, { body });
   if (!error) {
      const res = (data as RelayResponse) ?? {};
      if (res.ok === false) throw new RelayWaltError(res.error ?? 'Something went wrong', res.code ?? 'error');
      return res;
   }
   const context = (error as { context?: { json?: () => Promise<RelayResponse> } }).context;
   const res = await context?.json?.().catch(() => null);
   throw new RelayWaltError(res?.error ?? error.message, res?.code ?? 'error');
};

const asTransfer = (res: RelayResponse): RelayTransfer & { waltAddress: string | null; relayStatus: string | null } => {
   if (!res.transferId || !res.depositAddress || !res.amountIn) throw new RelayWaltError('Bad answer from the server', 'bad_response');
   return { ...(res as RelayTransfer), waltAddress: res.waltAddress ?? null, relayStatus: res.relayStatus ?? null };
};

export const relayWalt = {
   /** Quote + one-time deposit address for a cash-out of exactly `amount` USDC (2 dp). */
   cashoutQuote: async (amount: string) => asTransfer(await call({ relay: 'cashout_quote', amount })),
   /** Tell the server the USDC was sent to the deposit address. */
   cashoutSent: async (transferId: string, txHash: string) => asTransfer(await call({ relay: 'cashout_sent', transferId, txHash })),
   /** One-time BNB Chain address for sending `amountUsdt` USDT (BEP20) from Walt. */
   repayQuote: async (amountUsdt: string) => asTransfer(await call({ relay: 'repay_quote', amountUsdt })),
   status: async (transferId: string) => asTransfer(await call({ relay: 'status', transferId })),
   /** The newest transfer in that direction (to resume), and the saved Walt address. */
   latest: async (direction: RelayDirection) => {
      const res = await call({ relay: 'latest', direction });
      return { transfer: res.transfer ?? null, waltAddress: res.waltAddress ?? null };
   }
};

/** Indonesia track: repaying straight to Moodeng's payout wallet (no Relay). */
export type IdRepayRequest = {
   requestId: number;
   address: string;
   /** Exact amount to send, e.g. "6.38" (it identifies the payment). */
   amountUsdt: string;
   approxIdr: number | null;
   rupiahLeft: number | null;
   expiresAt: string;
};
export type IdRepayStatus = {
   requestId: number;
   status: 'open' | 'paid' | 'expired' | 'replaced';
   address: string;
   amountUsdt: string;
   expiresAt: string;
   received: { status: string; token: string; amount: number } | null;
   recorded: boolean;
   /** The whole loan is repaid (a recorded payment can be partial). */
   loanPaid: boolean;
};

export const idRepay = {
   /** The payout wallet + exact amount for the active loan (reuses an open one). */
   request: async (): Promise<IdRepayRequest> => {
      const res = (await call({ relay: 'id_repay' })) as unknown as Partial<IdRepayRequest>;
      if (!res.requestId || !res.address || !res.amountUsdt) throw new RelayWaltError('Bad answer from the server', 'bad_response');
      return res as IdRepayRequest;
   },
   status: async (requestId: number): Promise<IdRepayStatus> => (await call({ relay: 'id_repay_status', requestId })) as unknown as IdRepayStatus
};

export const isFinalRelayStatus = (s: string) => s === 'success' || s === 'failure' || s === 'refund' || s === 'expired';

/**
 * A price estimate straight from Relay (no key, CORS open), for the preview line while the person
 * types. Nothing is stored and nothing is sent to it; the real quote comes from the server when
 * they tap. Returns null on any problem.
 */
export const estimateCashout = async (args: {
   amountUsdc: string;
   wallet: string;
   walt: string;
   signal?: AbortSignal;
}): Promise<{ amountOut: number; feeUsd: number; seconds: number | null } | null> => {
   const m = /^(0|[1-9][0-9]{0,5})(\.[0-9]{1,2})?$/.exec(args.amountUsdc.trim());
   if (!m) return null;
   const [whole, frac = '.'] = [m[1], m[2] ?? '.'];
   const units = BigInt(whole) * 1_000_000n + BigInt((frac.slice(1) || '0').padEnd(6, '0'));
   if (units < 1_000_000n) return null;
   try {
      const res = await fetch('https://api.relay.link/quote', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         signal: args.signal,
         body: JSON.stringify({
            user: args.wallet,
            recipient: args.walt,
            originChainId: 8453,
            destinationChainId: BSC_CHAIN_ID,
            originCurrency: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            destinationCurrency: BSC_USDC_ADDRESS,
            amount: units.toString(),
            // A plain quote (no deposit address) — this is only an estimate.
            tradeType: 'EXACT_INPUT'
         })
      });
      if (!res.ok) return null;
      const q = (await res.json()) as {
         details?: { currencyOut?: { amountFormatted?: string }; timeEstimate?: number };
         fees?: { relayer?: { amountUsd?: string }; gas?: { amountUsd?: string } };
      };
      const amountOut = Number(q.details?.currencyOut?.amountFormatted);
      if (!Number.isFinite(amountOut)) return null;
      const feeUsd = (Number(q.fees?.relayer?.amountUsd) || 0) + (Number(q.fees?.gas?.amountUsd) || 0);
      const seconds = Number(q.details?.timeEstimate);
      return { amountOut, feeUsd, seconds: Number.isFinite(seconds) ? seconds : null };
   } catch {
      return null;
   }
};

// ── USD → IDR (open.er-api.com, free, daily). Cached per tab + in localStorage; fails quietly. ──
const IDR_CACHE_KEY = 'moodeng:usd-idr';
const IDR_TTL_MS = 6 * 60 * 60_000;
let idrMemo: { rate: number; at: number } | null = null;
let idrInflight: Promise<number | null> | null = null;

const readIdrCache = (): { rate: number; at: number } | null => {
   if (idrMemo && Date.now() - idrMemo.at < IDR_TTL_MS) return idrMemo;
   try {
      const raw = window.localStorage.getItem(IDR_CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as { rate?: number; at?: number }) : null;
      if (parsed?.rate && parsed.at && Date.now() - parsed.at < IDR_TTL_MS) {
         idrMemo = { rate: parsed.rate, at: parsed.at };
         return idrMemo;
      }
   } catch {
      // storage blocked: fine, fetch again
   }
   return null;
};

export const fetchUsdIdr = (): Promise<number | null> => {
   const cached = readIdrCache();
   if (cached) return Promise.resolve(cached.rate);
   if (idrInflight) return idrInflight;
   idrInflight = fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { rates?: Record<string, number> } | null) => {
         const rate = Number(d?.rates?.IDR);
         if (!Number.isFinite(rate) || rate <= 0) return null;
         idrMemo = { rate, at: Date.now() };
         try {
            window.localStorage.setItem(IDR_CACHE_KEY, JSON.stringify(idrMemo));
         } catch {
            // ignore
         }
         return rate;
      })
      .catch(() => null)
      .finally(() => {
         idrInflight = null;
      });
   return idrInflight;
};

/** USD→IDR rate, or null while loading / if it can't be read. */
export function useUsdIdrRate(): number | null {
   const [rate, setRate] = useState<number | null>(() => readIdrCache()?.rate ?? null);
   useEffect(() => {
      if (rate != null) return;
      let alive = true;
      void fetchUsdIdr().then((r) => {
         if (alive && r != null) setRate(r);
      });
      return () => {
         alive = false;
      };
   }, [rate]);
   return rate;
}

/** "≈ Rp 245.000" (Indonesian grouping, rounded to Rp 100). */
export const formatRupiah = (usd: number, rate: number | null): string | null => {
   if (rate == null || !Number.isFinite(usd)) return null;
   const rp = Math.round((usd * rate) / 100) * 100;
   return `≈ Rp ${rp.toLocaleString('id-ID')}`;
};
