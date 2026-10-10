// Records Instant Wallet failures so we can see them. Before this, a wallet that failed to create
// or link only wrote to the user's own browser console, so a support ticket ("I couldn't create a
// wallet") had nothing behind it on our side. PostHog's distinct_id is the Supabase user id, so
// these events line up with the account.
import posthog from 'posthog-js';

/** `create`: the mint/provision step failed. `link`: the wallet exists but saving it to the account failed. `send`: a repayment/withdrawal from it failed. */
export type InstantWalletFailureStage = 'create' | 'link' | 'send';

export const reportInstantWalletFailure = (stage: InstantWalletFailureStage, err: unknown): void => {
   if (!import.meta.env.PROD) return;
   const message = err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown';
   posthog.capture('instant_wallet_failed', { stage, error: message.slice(0, 300) });
};
