import { getPaymentStatus, pay, type PaymentStatus } from '@base-org/account';

import { ERROR_CODES, type ErrorCode } from '@/types/errorCodes';

/**
 * Base Pay (`pay()` from `@base-org/account`) fuses Base Account sign-in and a USDC-on-Base
 * transfer into a SINGLE popup — the cold-start, one-tap path that a raw wagmi
 * `writeContractAsync` can never be (connect + sign are two popups). This module is the one
 * place that talks to the SDK so every money surface (lend, repay, return-interest, withdraw)
 * shares the same call, confirmation-poll, and error mapping instead of forking five ways.
 *
 * Base Pay is Base-Account-only; non-Base wallets stay on the wagmi `useWallet().Transfer`
 * path. See [[wallet-double-tap-root-cause]] for why this exists.
 */

// USDC-on-Base only, forever (a hard product invariant), so we never send Base Sepolia in
// production. An env override exists purely so a testnet build can exercise the flow.
const USE_TESTNET = import.meta.env.VITE_BASE_PAY_TESTNET === 'true';

// pay() resolves the moment the user approves; the userOp still has to land on-chain, so we
// poll getPaymentStatus to confirmation. These bound that poll.
const DEFAULT_POLL_TIMEOUT_MS = 90_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;

export type BasePaymentFailureKind =
   | 'rejected' // user dismissed the popup
   | 'insufficient' // not enough USDC/gas
   | 'failed' // userOp definitively reverted on-chain — money did NOT move
   | 'unknown' // pay() threw with an unrecognized message — money MAY still have moved
   | 'timeout'; // approved but not confirmed before the deadline — money MAY still land

/**
 * A classified Base Pay failure. `kind === 'timeout'` and `kind === 'unknown'` are deliberately
 * NOT hard failures: the payment can still confirm later, so callers that have already armed
 * reconciliation should record `id` and reconcile rather than tell the user it failed. Only
 * `failed` (a confirmed on-chain revert), `insufficient`, and `rejected` are definitive.
 * `errorCode` maps to our existing toast catalogue.
 */
export class BasePaymentError extends Error {
   readonly kind: BasePaymentFailureKind;
   readonly errorCode: ErrorCode;
   /** Present once pay() has returned — lets a timed-out caller reconcile the userOp later. */
   readonly paymentId?: string;

   constructor(kind: BasePaymentFailureKind, message: string, paymentId?: string) {
      super(message);
      this.name = 'BasePaymentError';
      this.kind = kind;
      this.paymentId = paymentId;
      this.errorCode =
         kind === 'rejected'
            ? ERROR_CODES.TRANSACTION_REJECTED
            : kind === 'insufficient'
              ? ERROR_CODES.INSUFFICIENT_FUNDS
              : ERROR_CODES.TRANSACTION_FAILED;
   }
}

/** Confirmed, on-chain-settled Base Pay result. `id` is the userOp hash (stored as our `hash`). */
export interface BasePaymentConfirmed {
   id: string;
   /** The wallet that actually paid — the source of truth for e.g. `lender_wallet`. */
   sender?: string;
   amount?: string;
   recipient?: string;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// pay() throws a plain Error on cancel/failure with no stable code, so we sniff the message.
// Conservative on purpose: only an unambiguous rejection maps to "rejected" (so we don't
// swallow a real failure as a user cancel), and only an unambiguous balance error to
// "insufficient". Anything else is `unknown`, NOT `failed`: pay() can resolve-then-throw after
// the userOp is already broadcasting, so a message we don't recognize does not prove the money
// stayed put. Callers with reconciliation armed treat `unknown` as reconcile-later; only an
// explicit on-chain revert (from waitForBasePayment) is a hard `failed`.
export const classifyBasePayThrow = (err: unknown): BasePaymentError => {
   if (err instanceof BasePaymentError) return err;

   const message = err instanceof Error ? err.message : String(err ?? 'Payment failed');
   const normalized = message.toLowerCase();

   if (/reject|denied|cancel|dismiss|closed|user (declined|refused)/.test(normalized)) {
      return new BasePaymentError('rejected', message);
   }
   if (/insufficient|balance|not enough|exceeds/.test(normalized)) {
      return new BasePaymentError('insufficient', message);
   }
   return new BasePaymentError('unknown', message);
};

/**
 * Open the single Base Pay popup. Resolves with the userOp hash once the user approves;
 * throws a {@link BasePaymentError} on cancel/failure. Does NOT wait for on-chain
 * confirmation — call {@link waitForBasePayment} with the returned id for that.
 *
 * @param usdAmount USD dollar string, e.g. "25.00" (sent 1:1 as USDC on Base).
 */
export async function startBasePayment({
   to,
   usdAmount,
   dataSuffix
}: {
   to: string;
   usdAmount: string;
   dataSuffix?: `0x${string}`;
}): Promise<{ id: string; to: string }> {
   try {
      const result = await pay({
         amount: usdAmount,
         to,
         testnet: USE_TESTNET,
         ...(dataSuffix ? { dataSuffix } : {})
      });
      return { id: result.id, to: result.to };
   } catch (err) {
      throw classifyBasePayThrow(err);
   }
}

/**
 * Poll {@link getPaymentStatus} until the userOp reaches a terminal state.
 *
 * - `completed` → resolves with the confirmed result (including the real payer `sender`).
 * - `failed` → throws `BasePaymentError('failed', reason)`.
 * - still `pending`/`not_found` at the deadline → throws `BasePaymentError('timeout', …)`,
 *   which callers must treat as "unknown, reconcile later" (the money may still settle),
 *   NOT as a definitive failure.
 *
 * `not_found` early on is normal (bundler indexing lag), so it is treated as pending.
 */
export async function waitForBasePayment(
   id: string,
   { timeoutMs = DEFAULT_POLL_TIMEOUT_MS, intervalMs = DEFAULT_POLL_INTERVAL_MS }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<BasePaymentConfirmed> {
   const deadline = Date.now() + timeoutMs;
   // getPaymentStatus can briefly report `failed` for a userOp that then settles (bundler churn),
   // so we don't trust a single reading — a payment reported failed but actually confirmed used to
   // surface a hard "Transaction Error" while the money moved. Require two consecutive `failed`
   // reads before treating it as a definitive revert; any non-failed reading resets the count.
   let consecutiveFailedReads = 0;

   for (;;) {
      let status: PaymentStatus;
      try {
         status = await getPaymentStatus({ id, testnet: USE_TESTNET });
      } catch (err) {
         // A transient RPC/bundler hiccup shouldn't abort a real payment: keep polling until
         // the deadline, then surface a timeout the caller can reconcile.
         consecutiveFailedReads = 0;
         if (Date.now() >= deadline) {
            throw new BasePaymentError('timeout', err instanceof Error ? err.message : 'Payment status unavailable', id);
         }
         await delay(intervalMs);
         continue;
      }

      if (status.status === 'completed') {
         return { id, sender: status.sender, amount: status.amount, recipient: status.recipient };
      }
      if (status.status === 'failed') {
         consecutiveFailedReads += 1;
         if (consecutiveFailedReads >= 2) {
            throw new BasePaymentError('failed', status.reason ?? status.message ?? 'Payment failed on-chain', id);
         }
         // First failed reading — could be a transient blip. Poll once more to confirm (or, past
         // the deadline, hand off to reconciliation rather than declaring a hard failure).
         if (Date.now() >= deadline) {
            throw new BasePaymentError('timeout', 'Payment was not confirmed in time', id);
         }
         await delay(intervalMs);
         continue;
      }

      // pending | not_found → keep waiting until the deadline.
      consecutiveFailedReads = 0;
      if (Date.now() >= deadline) {
         throw new BasePaymentError('timeout', 'Payment was not confirmed in time', id);
      }
      await delay(intervalMs);
   }
}

/**
 * One-shot convenience: open the popup and wait for on-chain confirmation.
 * Returns the confirmed result (userOp hash + real payer). Throws {@link BasePaymentError}.
 */
export async function sendUsdcViaBasePay(args: {
   to: string;
   usdAmount: string;
   dataSuffix?: `0x${string}`;
   timeoutMs?: number;
   intervalMs?: number;
}): Promise<BasePaymentConfirmed> {
   const { id } = await startBasePayment(args);
   return waitForBasePayment(id, { timeoutMs: args.timeoutMs, intervalMs: args.intervalMs });
}
