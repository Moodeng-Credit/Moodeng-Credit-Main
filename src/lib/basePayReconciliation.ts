import { getPaymentStatus } from '@base-org/account';

/**
 * Base Pay's `pay()` returns only after the popup is approved, then we poll for on-chain
 * confirmation. If that poll times out (approved but not yet confirmed in our window) or the tab
 * is closed mid-poll, the money has moved but the DB write that marks the loan Lent/Paid never
 * happened — a stuck loan (see [[funding-desync-recovery]], [[base-pay-migration]]).
 *
 * This is the client-side safety net: the moment a Base Pay payment is approved we persist just
 * enough to finish the DB write later, and a reconciler replays it on the next load. A backend
 * cron is the follow-up for the "tab closed and never reopened" case.
 *
 * Wagmi (`method: 'wallet'`) payments park here too: once the tx hash exists the money is in
 * flight, so a DB confirm that then fails (network drop, expired session, server hiccup) must be
 * retried rather than stranding a funded/repaid loan that still reads Requested/Unpaid.
 */

const STORAGE_KEY = 'moodeng.pendingBasePayments.v1';
const USE_TESTNET = import.meta.env.VITE_BASE_PAY_TESTNET === 'true';

// Don't reconcile an entry until it's older than this: a just-submitted payment is still being
// polled by the live payUsdc call, and we must not race it into a double DB write.
const MIN_RECONCILE_AGE_MS = 2 * 60 * 1000;
// Give up (drop the entry) after this — a payment that never confirms in a day won't now.
const MAX_ENTRY_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * The DB completion a confirmed payment still owes. `id` is the payment id (userOp hash, or the
 * tx hash on the wagmi path), stored as the loan `hash`. Kept as a distinct input type (without
 * `createdAt`) so the discriminated union survives — `Omit` over a union collapses the
 * per-variant fields.
 *
 * `method` says how the money was sent. `'base'` (the default, so pre-existing stored entries
 * keep working) entries are polled via Base Pay's payment status before completion; `'wallet'`
 * (wagmi) entries have no Base Pay status to poll, so completion is attempted directly — the
 * confirm-loan-payment Edge Function verifies the on-chain transfer itself and rejects until it
 * has settled.
 */
export type PendingBasePaymentInput = (
   | { kind: 'fund'; id: string; loanId: string; userId: string }
   | { kind: 'repay'; id: string; loanId: string; repaidAmount: number; repaymentStatus: string }
   | { kind: 'interest'; id: string; loanId: string }
   | { kind: 'withdraw'; id: string; userId: string; amount: number; exchange: string; address: string }
) & { method?: 'base' | 'wallet' };

export type PendingBasePayment = PendingBasePaymentInput & { createdAt: number };

const isBrowser = () => typeof window !== 'undefined' && !!window.localStorage;

export function listPendingBasePayments(): PendingBasePayment[] {
   if (!isBrowser()) return [];
   try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as PendingBasePayment[]) : [];
   } catch {
      return [];
   }
}

function writeAll(entries: PendingBasePayment[]) {
   if (!isBrowser()) return;
   try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
   } catch {
      // storage full / disabled — reconciliation just degrades to "not persisted"; the live
      // poll is still the primary path.
   }
}

/** Persist a just-approved Base Pay payment so its DB write can be recovered. Idempotent on `id`. */
export function registerPendingBasePayment(entry: PendingBasePaymentInput) {
   const existing = listPendingBasePayments().filter((e) => e.id !== entry.id);
   writeAll([...existing, { ...entry, createdAt: Date.now() }]);
}

/** Remove an entry once its payment has settled (confirmed + written, or failed). */
export function clearPendingBasePayment(id: string) {
   writeAll(listPendingBasePayments().filter((e) => e.id !== id));
}

/** Dispatches for the completions the reconciler can replay, one per payment kind. */
export interface ReconcileHandlers {
   completeFund: (args: { loanId: string; userId: string; wallet?: string; hash: string; method: 'base' | 'wallet' }) => Promise<void>;
   completeRepay: (args: {
      loanId: string;
      repaidAmount: number;
      repaymentStatus: string;
      hash: string;
      method: 'base' | 'wallet';
   }) => Promise<void>;
   completeInterest: (args: { loanId: string; hash: string; method: 'base' | 'wallet' }) => Promise<void>;
   completeWithdraw: (args: { userId: string; amount: number; exchange: string; address: string; hash: string }) => Promise<void>;
}

/**
 * Re-check every persisted payment and finish the ones that have confirmed. Skips entries younger
 * than {@link MIN_RECONCILE_AGE_MS} (still owned by a live poll), completes `completed` ones, and
 * drops `failed`/`not_found` and stale entries. Errors on one entry never block the others.
 */
export async function reconcilePendingBasePayments(handlers: ReconcileHandlers, now: number = Date.now()): Promise<void> {
   for (const entry of listPendingBasePayments()) {
      const age = now - entry.createdAt;
      if (age < MIN_RECONCILE_AGE_MS) continue;

      if (age > MAX_ENTRY_AGE_MS) {
         clearPendingBasePayment(entry.id);
         continue;
      }

      const method = entry.method ?? 'base';
      let payerWallet: string | undefined;

      // Only Base Pay payments have a status to poll. A wagmi tx hash isn't a Base Pay id, so
      // wallet entries go straight to completion — confirm-loan-payment verifies the transfer
      // on-chain itself, keeps returning retry-later until it settles, and the entry expires at
      // MAX_ENTRY_AGE_MS if the tx never lands.
      if (method === 'base') {
         let status;
         try {
            status = await getPaymentStatus({ id: entry.id, testnet: USE_TESTNET });
         } catch {
            // Transient — leave it for the next pass.
            continue;
         }

         if (status.status === 'failed') {
            // The money never moved, so there is nothing to write.
            clearPendingBasePayment(entry.id);
            continue;
         }
         if (status.status !== 'completed') {
            continue; // pending / not_found — try again later.
         }
         payerWallet = status.sender;
      }

      try {
         if (entry.kind === 'fund') {
            await handlers.completeFund({ loanId: entry.loanId, userId: entry.userId, wallet: payerWallet, hash: entry.id, method });
         } else if (entry.kind === 'repay') {
            await handlers.completeRepay({
               loanId: entry.loanId,
               repaidAmount: entry.repaidAmount,
               repaymentStatus: entry.repaymentStatus,
               hash: entry.id,
               method
            });
         } else if (entry.kind === 'interest') {
            await handlers.completeInterest({ loanId: entry.loanId, hash: entry.id, method });
         } else {
            await handlers.completeWithdraw({
               userId: entry.userId,
               amount: entry.amount,
               exchange: entry.exchange,
               address: entry.address,
               hash: entry.id
            });
         }
         clearPendingBasePayment(entry.id);
      } catch {
         // DB write failed — keep the entry and retry on the next pass.
      }
   }
}
