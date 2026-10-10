// Recognises the Instant Wallet send failures that mean "this tab lost its signer", as opposed to
// a real payment problem. Pure + dependency-free so it's unit-testable in isolation.
//
// The SDK decides the wallet is READY purely from a record in this page's storage, but the key
// that signs lives in Openfort's hidden iframe. When the two drift apart (seen on iPhone Safari,
// 2026-10-10: eight repay taps in a row failed with "Signer is not configured" until the borrower
// logged in from another browser) every send fails BEFORE anything is signed or submitted. viem
// then wraps it as `The contract function "transfer" reverted … Signer is not configured`, which
// is not an on-chain revert, and the borrower got a generic "Transaction Error — Try again?" that
// retrying in the same tab could never fix.

// Openfort error codes (`error` on OpenfortError) for a signer the iframe no longer holds.
const LOST_SIGNER_CODES = new Set(['NOT_CONFIGURED', 'MISSING_SIGNER', 'MISSING_PROJECT_ENTROPY']);

// Messages of the same failures, matched as a fallback because viem re-wraps the provider error
// and doesn't always keep the original on the `cause` chain. Every one of these is raised before a
// signature reaches Openfort, so nothing was sent and a retry can't double-pay.
const LOST_SIGNER_MESSAGE =
   /signer is not configured|project entropy is missing|wallet session ended before setup completed|iframe connection was closed while|iframe signer returned an empty signature/i;

const MAX_CAUSE_DEPTH = 8;

/** True when the send failed because the embedded signer is gone, not because of the payment. */
export const isLostSignerError = (err: unknown): boolean => {
   let current: unknown = err;
   for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth += 1) {
      if (typeof current === 'string') return LOST_SIGNER_MESSAGE.test(current);
      if (typeof current !== 'object') return false;
      const { error, message, cause } = current as { error?: unknown; message?: unknown; cause?: unknown };
      if (typeof error === 'string' && LOST_SIGNER_CODES.has(error)) return true;
      if (typeof message === 'string' && LOST_SIGNER_MESSAGE.test(message)) return true;
      current = cause;
   }
   return false;
};

/**
 * Thrown when the signer is still missing after a full reset and rebuild. The fix is outside this
 * tab (sign in again, or use another browser), so callers show that instead of "try again".
 */
export class InstantWalletReconnectError extends Error {
   constructor(cause: unknown) {
      super('Instant Wallet signer is unavailable in this browser session.', { cause });
      this.name = 'InstantWalletReconnectError';
   }
}
