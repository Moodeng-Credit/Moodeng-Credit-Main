/**
 * Rejects with {@link WalletTimeoutError} if `promise` does not settle within `ms`.
 *
 * Wallet RPCs (a wagmi `writeContract`, a `switchChain`) have no abort signal, so a
 * request sent to a wallet that never answers — e.g. a WalletConnect session to a phone
 * that's asleep, or a stale connection with no live provider in this browser — leaves the
 * promise pending forever. That is exactly what stranded a lender on the "Approve in your
 * wallet" spinner with no way forward. Racing the call against a timer converts that
 * silent hang into an error the UI can act on.
 *
 * The underlying promise can't be cancelled, so a late resolution is simply ignored;
 * callers that mutate UI on success already guard it (e.g. `cancelledRef` in the lend flow).
 */
export class WalletTimeoutError extends Error {
   constructor(message = 'Wallet did not respond in time') {
      super(message);
      this.name = 'WalletTimeoutError';
   }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
   let timer: ReturnType<typeof setTimeout>;
   const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new WalletTimeoutError(message)), ms);
   });
   return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * How long to wait for a wallet to respond to a signature/transaction request before we
 * stop the spinner and tell the lender what to do. Generous enough for a real human to
 * approve a MetaMask prompt (including a cross-device WalletConnect round-trip), short
 * enough that a dead connection doesn't hang indefinitely.
 */
export const WALLET_RESPONSE_TIMEOUT_MS = 60_000;

/**
 * A chain switch is a quick wallet round-trip with no human signing step, so it gets a
 * tighter budget than a full transaction approval.
 */
export const WALLET_CHAIN_SWITCH_TIMEOUT_MS = 30_000;
