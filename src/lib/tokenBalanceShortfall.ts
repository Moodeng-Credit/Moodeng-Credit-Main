import { stringToHex } from 'viem';

// The revert reason a USDC (ERC-20) transfer gives when the sender holds less than it's sending.
// Unlike running out of ETH for gas, viem has no typed error for it — the reason text is all there is.
const SHORTFALL_REASON = 'transfer amount exceeds balance';

// A bundler that simulates the userOp first (Openfort's Instant Wallet) reports the revert as raw
// ABI-encoded `Error(string)` data, so the reason only appears hex-encoded in the message:
// "UserOperation reverted during simulation with reason: 0x08c379a0…7472616e7366657220616d6f…".
// Seen 2026-11-08: a borrower with $0 tapped Pay $17 twice and got a generic "Transaction Error".
const SHORTFALL_REASON_HEX = stringToHex(SHORTFALL_REASON).slice(2).toLowerCase();

const MAX_CAUSE_DEPTH = 8;

const messageShowsShortfall = (message: string): boolean => {
   const normalized = message.toLowerCase();
   return normalized.includes(SHORTFALL_REASON) || normalized.includes(SHORTFALL_REASON_HEX);
};

/** True when a send failed because the wallet holds less of the token than it tried to send. */
export const isTokenBalanceShortfall = (err: unknown): boolean => {
   let current: unknown = err;
   for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth += 1) {
      if (typeof current === 'string') return messageShowsShortfall(current);
      if (typeof current !== 'object') return false;
      const { message, details, cause } = current as { message?: unknown; details?: unknown; cause?: unknown };
      if (typeof message === 'string' && messageShowsShortfall(message)) return true;
      if (typeof details === 'string' && messageShowsShortfall(details)) return true;
      current = cause;
   }
   return false;
};
