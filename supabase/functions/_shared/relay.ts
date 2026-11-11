// Relay (api.relay.link) quotes and status for the Indonesia track's Walt bridge.
//
//   Cash-out: USDC on Base (the borrower's Moodeng wallet) → Relay one-time deposit address on Base
//             → USDC on BNB Chain to their Walt address.
//   Repay:    USDT on BNB Chain (from Walt) → Relay one-time deposit address on BNB Chain
//             → USDC on Base to their Moodeng wallet (app), or straight to loans.lender_wallet
//             (the Telegram bot, _shared/idRepayments.ts).
//
// No API key is needed for /quote or /intents/status/v3. We use `useDepositAddress: true`, so the
// money moves with a plain ERC-20 transfer to `steps[0].depositAddress` (no approvals, no calldata
// from Relay is ever signed). A deposit of a different amount fills at market (new request) or is
// refunded to `refundTo` if it's too small; extra deposits to a used address are refunded too.
//
// Decimals: Base USDC = 6, BNB Chain USDC = 18, BNB Chain USDT = 18. Amounts are converted with
// string/bigint math only — never floats for token units.
//
// Field names checked against live quotes on 2026-11-07 (steps[0].depositAddress / requestId,
// details.currencyOut.amount/amountFormatted, details.timeEstimate (seconds), fees.relayer.amountUsd,
// fees.gas.amountUsd). Relay has no quote expiry field for deposit-address quotes.

export const RELAY_API = 'https://api.relay.link';

export const BASE_CHAIN_ID = 8453;
export const BSC_CHAIN_ID = 56;
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BSC_USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
export const BSC_USDT = '0x55d398326f99059fF775485246999027B3197955';
export const BASE_USDC_DECIMALS = 6;
export const BSC_TOKEN_DECIMALS = 18;

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;
const TIMEOUT_MS = 12_000;

export class RelayError extends Error {
   readonly code: string;
   readonly status: number;
   constructor(message: string, code: string, status = 502) {
      super(message);
      this.name = 'RelayError';
      this.code = code;
      this.status = status;
   }
}

// ── amount math (strings + bigint only) ─────────────────────────────────────────────────────────

/** "12.5" → 12500000n for 6 decimals. Rejects negatives, exponents and more decimals than the token has. */
export const toUnits = (amount: string, decimals: number): bigint => {
   const s = String(amount ?? '').trim();
   if (!/^(0|[1-9][0-9]{0,12})(\.[0-9]+)?$/.test(s)) throw new RelayError('Enter an amount like 10 or 10.50.', 'bad_amount', 400);
   const [whole, frac = ''] = s.split('.');
   if (frac.length > decimals) throw new RelayError(`At most ${decimals} decimals.`, 'bad_amount', 400);
   return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0');
};

/** 12500000n, 6 → "12.5" (trailing zeros trimmed, always at least one integer digit). */
export const fromUnits = (units: bigint, decimals: number): string => {
   const neg = units < 0n;
   const abs = neg ? -units : units;
   const base = 10n ** BigInt(decimals);
   const whole = abs / base;
   const frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
   return `${neg ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`;
};

// ── HTTP ────────────────────────────────────────────────────────────────────────────────────────

const relayFetch = async (path: string, init?: RequestInit): Promise<unknown> => {
   let res: Response;
   try {
      res = await fetch(`${RELAY_API}${path}`, {
         ...init,
         headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(init?.headers ?? {}) },
         signal: AbortSignal.timeout(TIMEOUT_MS)
      });
   } catch (err) {
      const timedOut = (err as Error)?.name === 'TimeoutError';
      throw new RelayError(timedOut ? 'Relay took too long. Try again.' : 'Relay is unreachable. Try again.', 'relay_unreachable');
   }
   const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
   if (!res.ok) {
      const code = typeof body?.errorCode === 'string' ? body.errorCode : `http_${res.status}`;
      const message = typeof body?.message === 'string' ? body.message.slice(0, 300) : `Relay error ${res.status}`;
      // 4xx from Relay = the quote itself can't be made (amount too low, no route, …).
      throw new RelayError(message, code, res.status >= 400 && res.status < 500 ? 422 : 502);
   }
   if (!body || typeof body !== 'object') throw new RelayError('Relay sent an empty answer.', 'relay_bad_response');
   return body;
};

// ── quotes ──────────────────────────────────────────────────────────────────────────────────────

export type RelayQuote = {
   requestId: string;
   depositAddress: string;
   originChainId: number;
   destinationChainId: number;
   originToken: string;
   destinationToken: string;
   /** Exact amount to send to the deposit address, in origin token units (string of digits). */
   amountInUnits: string;
   /** Human amount in, e.g. "20" (USDC) or "20.5" (USDT). */
   amountIn: string;
   /** Expected amount out (human), e.g. "19.931566". */
   amountOut: string;
   amountOutUnits: string;
   /** Worst case after slippage (human), if Relay gave one. */
   amountOutMin: string | null;
   /** Total fee in USD (relayer + gas), rounded to 4 dp, as Relay reported. */
   feeUsd: number | null;
   /** Seconds. */
   timeEstimate: number | null;
   /** The raw quote (stored on the relay_transfers row for support). */
   raw: unknown;
};

type QuoteBody = {
   user: string;
   recipient: string;
   originChainId: number;
   destinationChainId: number;
   originCurrency: string;
   destinationCurrency: string;
   amount: string;
   tradeType: 'EXACT_INPUT';
   useDepositAddress: true;
   refundTo: string;
};

const num = (v: unknown): number | null => {
   const n = Number(v);
   return Number.isFinite(n) ? n : null;
};

const parseQuote = (raw: unknown, req: QuoteBody, outDecimals: number): RelayQuote => {
   const q = raw as {
      steps?: Array<{
         requestId?: string;
         depositAddress?: string;
         items?: Array<{ data?: { to?: string; data?: string; chainId?: number } }>;
      }>;
      fees?: Record<string, { amountUsd?: string } | undefined>;
      details?: {
         currencyIn?: { amount?: string; amountFormatted?: string; currency?: { address?: string; chainId?: number } };
         currencyOut?: {
            amount?: string;
            amountFormatted?: string;
            minimumAmount?: string;
            currency?: { address?: string; chainId?: number; decimals?: number };
         };
         timeEstimate?: number;
      };
   };
   const step = q.steps?.[0];
   const depositAddress = String(step?.depositAddress ?? '');
   const requestId = String(step?.requestId ?? '');
   if (!EVM_ADDRESS.test(depositAddress)) throw new RelayError('Relay did not give a deposit address.', 'relay_no_deposit_address');
   if (!HASH.test(requestId)) throw new RelayError('Relay did not give a request id.', 'relay_no_request_id');

   // The transaction Relay asks for must be a plain transfer of OUR origin token, on the origin chain,
   // to that same deposit address, for exactly our amount. Anything else → refuse the quote.
   const tx = step?.items?.[0]?.data;
   const expectedData =
      '0xa9059cbb' + depositAddress.slice(2).toLowerCase().padStart(64, '0') + BigInt(req.amount).toString(16).padStart(64, '0');
   if (
      !tx ||
      String(tx.to ?? '').toLowerCase() !== req.originCurrency.toLowerCase() ||
      Number(tx.chainId) !== req.originChainId ||
      String(tx.data ?? '').toLowerCase() !== expectedData
   ) {
      throw new RelayError('Relay quote did not match the transfer we asked for.', 'relay_quote_mismatch');
   }

   const out = q.details?.currencyOut;
   if (
      String(out?.currency?.address ?? '').toLowerCase() !== req.destinationCurrency.toLowerCase() ||
      Number(out?.currency?.chainId) !== req.destinationChainId ||
      !/^[0-9]+$/.test(String(out?.amount ?? ''))
   ) {
      throw new RelayError('Relay quote has an unexpected destination.', 'relay_quote_mismatch');
   }
   const decimals = Number(out?.currency?.decimals ?? outDecimals);
   if (decimals !== outDecimals) throw new RelayError('Relay quote has unexpected decimals.', 'relay_quote_mismatch');
   const outUnits = BigInt(String(out!.amount));
   if (outUnits <= 0n) throw new RelayError('Amount is too small to send.', 'amount_too_low', 422);
   const minUnits = /^[0-9]+$/.test(String(out?.minimumAmount ?? '')) ? BigInt(String(out!.minimumAmount)) : null;

   const relayerUsd = num(q.fees?.relayer?.amountUsd);
   const gasUsd = num(q.fees?.gas?.amountUsd);
   const feeUsd = relayerUsd == null && gasUsd == null ? null : Math.round(((relayerUsd ?? 0) + (gasUsd ?? 0)) * 10_000) / 10_000;

   const inDecimals = req.originChainId === BASE_CHAIN_ID ? BASE_USDC_DECIMALS : BSC_TOKEN_DECIMALS;
   return {
      requestId,
      depositAddress,
      originChainId: req.originChainId,
      destinationChainId: req.destinationChainId,
      originToken: req.originCurrency,
      destinationToken: req.destinationCurrency,
      amountInUnits: req.amount,
      amountIn: fromUnits(BigInt(req.amount), inDecimals),
      amountOut: fromUnits(outUnits, outDecimals),
      amountOutUnits: outUnits.toString(),
      amountOutMin: minUnits != null ? fromUnits(minUnits, outDecimals) : null,
      feeUsd,
      timeEstimate: num(q.details?.timeEstimate),
      raw
   };
};

const requireAddress = (label: string, value: string) => {
   if (!EVM_ADDRESS.test(String(value ?? '').trim())) throw new RelayError(`Invalid ${label} address.`, `bad_${label}`, 400);
   return String(value).trim();
};

const quote = async (body: QuoteBody, outDecimals: number) =>
   parseQuote(await relayFetch('/quote', { method: 'POST', body: JSON.stringify(body) }), body, outDecimals);

/**
 * Cash-out quote: `amountUsdc` (human, e.g. "20" or "20.5") of Base USDC from `user` → BNB Chain USDC
 * to `recipient` (their Walt address). Refunds go to `refundTo` on Base (their Moodeng wallet).
 */
export const relayQuoteCashout = (args: { amountUsdc: string; user: string; recipient: string; refundTo: string }) => {
   const units = toUnits(args.amountUsdc, BASE_USDC_DECIMALS);
   if (units <= 0n) throw new RelayError('Amount must be more than 0.', 'bad_amount', 400);
   return quote(
      {
         user: requireAddress('user', args.user),
         recipient: requireAddress('recipient', args.recipient),
         originChainId: BASE_CHAIN_ID,
         destinationChainId: BSC_CHAIN_ID,
         originCurrency: BASE_USDC,
         destinationCurrency: BSC_USDC,
         amount: units.toString(),
         tradeType: 'EXACT_INPUT',
         useDepositAddress: true,
         refundTo: requireAddress('refund', args.refundTo)
      },
      BSC_TOKEN_DECIMALS
   );
};

/**
 * Repay quote: `amountUsdt` (human) of BNB Chain USDT → Base USDC to `recipient` (their Moodeng
 * wallet in the app; the loan's lender_wallet from the Telegram bot). Refunds go to `refundTo` on BNB
 * Chain (their Walt address). `user` is only informative for deposit-address quotes; the refund
 * address is used for it.
 */
export const relayQuoteRepay = (args: { amountUsdt: string; recipient: string; refundTo: string }) => {
   const units = toUnits(args.amountUsdt, BSC_TOKEN_DECIMALS);
   if (units <= 0n) throw new RelayError('Amount must be more than 0.', 'bad_amount', 400);
   const refundTo = requireAddress('refund', args.refundTo);
   return quote(
      {
         user: refundTo,
         recipient: requireAddress('recipient', args.recipient),
         originChainId: BSC_CHAIN_ID,
         destinationChainId: BASE_CHAIN_ID,
         originCurrency: BSC_USDT,
         destinationCurrency: BASE_USDC,
         amount: units.toString(),
         tradeType: 'EXACT_INPUT',
         useDepositAddress: true,
         refundTo
      },
      BASE_USDC_DECIMALS
   );
};

// ── status ──────────────────────────────────────────────────────────────────────────────────────

export type RelayStatusValue = 'waiting' | 'pending' | 'submitted' | 'delayed' | 'success' | 'failure' | 'refund' | 'unknown';
const KNOWN: ReadonlySet<string> = new Set(['waiting', 'pending', 'submitted', 'delayed', 'success', 'failure', 'refund', 'unknown']);

export type RelayStatus = {
   status: RelayStatusValue;
   /** Relay's delivery tx on the destination chain (or the refund tx), when it has one. */
   fillTxHash: string | null;
   /** The deposit tx(s) Relay saw on the origin chain. */
   inTxHashes: string[];
   raw: unknown;
};

const hashesFrom = (v: unknown): string[] =>
   (Array.isArray(v) ? v : [])
      .map((h) => (typeof h === 'string' ? h : ((h as { txHash?: string; hash?: string })?.txHash ?? (h as { hash?: string })?.hash)))
      .filter((h): h is string => typeof h === 'string' && HASH.test(h));

/** GET /intents/status/v3 — no API key. */
export const relayStatus = async (requestId: string): Promise<RelayStatus> => {
   if (!HASH.test(String(requestId ?? ''))) throw new RelayError('Invalid request id.', 'bad_request_id', 400);
   const raw = (await relayFetch(`/intents/status/v3?requestId=${encodeURIComponent(requestId)}`)) as Record<string, unknown>;
   const s = String(raw.status ?? 'unknown').toLowerCase();
   return {
      status: (KNOWN.has(s) ? s : 'unknown') as RelayStatusValue,
      fillTxHash: hashesFrom(raw.txHashes)[0] ?? null,
      inTxHashes: hashesFrom(raw.inTxHashes),
      raw
   };
};

/** Our relay_transfers.status for a Relay status (null = leave the row's status as it is). */
export const rowStatusFor = (status: RelayStatusValue): 'pending' | 'success' | 'failure' | 'refund' | null => {
   if (status === 'success' || status === 'failure' || status === 'refund') return status;
   if (status === 'pending' || status === 'submitted' || status === 'delayed') return 'pending';
   return null;
};
