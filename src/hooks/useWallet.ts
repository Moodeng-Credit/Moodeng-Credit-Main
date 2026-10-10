import { useSelector } from 'react-redux';
import { BaseError, ChainMismatchError, InsufficientFundsError, parseUnits, UserRejectedRequestError } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { ALLOWED_CHAIN_DISPLAY_NAME, getAllowedChainTokenConfig } from '@/config/wagmiConfig';
import { BasePaymentError, startBasePayment, waitForBasePayment } from '@/lib/basePay';
import { isStaleChunkError, reloadOnceForStaleChunk } from '@/lib/staleChunkReload';
import { WALLET_RESPONSE_TIMEOUT_MS, WalletTimeoutError, withTimeout } from '@/lib/withTimeout';
import { OPENFORT_WALLET_PROVIDER, sendUsdcFromEmbeddedWallet, WalletGateError } from '@/lib/web3/openfort';
import { reportInstantWalletFailure } from '@/lib/web3/openfort/reportFailure';
import { InstantWalletReconnectError } from '@/lib/web3/openfort/sendErrors';
import type { RootState } from '@/store/store';
import { ERROR_CODES, type ErrorCode } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';

/**
 * How the USDC leaves the payer's hands:
 * - `base`    Base Account's one-popup pay (cold-start capable).
 * - `wallet`  a wagmi-connected wallet transfer.
 * - `openfort` a sponsored, gasless send from the borrower's Openfort embedded smart account —
 *             the PH escape hatch for users whose ISP blocks keys.coinbase.com.
 */
export type PaymentMethod = 'base' | 'wallet' | 'openfort';

export interface PaymentOutcome {
   /** On-chain identifier stored as the loan/withdrawal `hash` (a userOp hash on the Base Pay path). */
   hash: string;
   /**
    * The wallet that actually paid. Only the Base Pay path can report this (it comes back from
    * confirmation); on the wagmi path it's the already-known connected wallet, so callers keep
    * using their own `account.address` there and this stays undefined.
    */
   payer?: string;
}

// Opening questions for the support chat after a failed send. The bot answers from its knowledge
// base by keyword, so these must keep matching the "payment or wallet problem" entry there.
const WALLET_SUPPORT_TOPIC = 'I had a problem with a wallet transaction';
const INSTANT_WALLET_SUPPORT_TOPIC = 'My Instant Wallet payment failed';

// A USDC (ERC-20) balance shortfall. Unlike running out of ETH for gas, viem has no typed error
// for it — the token contract's revert reason is all there is.
const TOKEN_BALANCE_SHORTFALL = /transfer amount exceeds balance/i;

// Inspects the (often deeply-wrapped) wagmi/viem error to route to a toast the
// user can act on, instead of a generic "transaction failed" they can't self-correct.
const classifyTransferError = (err: unknown): ErrorCode => {
   // A wallet that never answered the request (dead/cross-device connection) — surface
   // the actionable "reconnect / approve on the other device" guidance, not a generic fail.
   if (err instanceof WalletTimeoutError) {
      return ERROR_CODES.WALLET_UNREACHABLE;
   }

   if (err instanceof BaseError) {
      if (err.walk((cause) => cause instanceof UserRejectedRequestError)) {
         return ERROR_CODES.TRANSACTION_REJECTED;
      }
      if (err.walk((cause) => cause instanceof ChainMismatchError)) {
         return ERROR_CODES.WRONG_NETWORK;
      }
      if (err.walk((cause) => cause instanceof InsufficientFundsError)) {
         return ERROR_CODES.INSUFFICIENT_FUNDS;
      }
   }

   if (err instanceof Error && TOKEN_BALANCE_SHORTFALL.test(err.message)) {
      return ERROR_CODES.INSUFFICIENT_FUNDS;
   }

   return ERROR_CODES.TRANSACTION_FAILED;
};

const ERC20_ABI = [
   {
      constant: false,
      inputs: [
         { name: 'to', type: 'address' },
         { name: 'amount', type: 'uint256' }
      ],
      name: 'transfer',
      outputs: [{ name: '', type: 'bool' }],
      type: 'function'
   },
   {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      type: 'function'
   }
];

/**
 * Collapses the send rail down to how the payment settles for the server. An Openfort send is a
 * normal on-chain USDC transfer with a real tx hash, so it's verified exactly like a `wallet`
 * payment (by hash) — the `confirm-loan-payment` fn and the reconciler only distinguish `base`
 * (poll Base Pay status) from everything else. Use this whenever a {@link PaymentMethod} flows
 * into `confirmLoanPayment` / `registerPendingBasePayment`, which speak only `base | wallet`.
 */
export const toSettlementMethod = (method: PaymentMethod): 'base' | 'wallet' => (method === 'base' ? 'base' : 'wallet');

/**
 * Resolves which rail a payment should use for the current user. A borrower locked to an
 * Openfort embedded wallet always sends via `openfort` (they have no wagmi connection and must
 * never fall through to Base Pay, which their ISP may block). Everyone else keeps the existing
 * rule: a connected wagmi wallet → `wallet`, otherwise Base Account's one-popup pay.
 *
 * Drop-in replacement for the inline `account.isConnected ? 'wallet' : 'base'` at the send sites.
 */
export const useActivePaymentMethod = (): PaymentMethod => {
   const { isConnected } = useAccount();
   const walletProvider = useSelector((state: RootState) => state.auth.user?.walletProvider);
   if (walletProvider === OPENFORT_WALLET_PROVIDER) return 'openfort';
   return isConnected ? 'wallet' : 'base';
};

const useWallet = () => {
   const { writeContractAsync } = useWriteContract();
   const { showToast, showToastByConfig } = useToast();

   // Show the failure toast and, when it's a genuine failure (not a user-cancelled transaction),
   // give it a "Get help" button that opens support with context — a stuck payment, repayment, or
   // withdrawal is then one tap from a human instead of a dead end. It used to open the chat by
   // itself, which covered the toast so the borrower never read the error (and the config's own
   // "Try again?" button did nothing). The error toast already brings the chat launcher on screen.
   const toastTransferFailure = (code: ErrorCode, supportTopic = WALLET_SUPPORT_TOPIC) => {
      if (code === ERROR_CODES.TRANSACTION_REJECTED) {
         showToastByConfig(getToastKeyFromErrorCode(code));
         return;
      }
      showToastByConfig(getToastKeyFromErrorCode(code), { supportTopic }, { buttonText: 'Get help', buttonAction: 'open_support_chat' });
   };

   const Transfer = async (
      recipient: string,
      amount: string,
      id: string,
      coin: string = 'USDC',
      // Called if the wallet answers AFTER we stopped waiting (e.g. approved later on the phone), so
      // the caller can still register the payment for recording instead of the money going unseen.
      onLateHash?: (hash: string) => void
   ): Promise<string | null> => {
      const tokenConfig = getAllowedChainTokenConfig();

      if (!tokenConfig) {
         console.error('[Transfer] Missing token configuration for', ALLOWED_CHAIN_DISPLAY_NAME, 'Loan ID:', id);
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return null;
      }

      const effectiveCoin = (tokenConfig as Record<string, string | number>)[coin] ? coin : 'USDC';
      const tokenAddress = (tokenConfig as Record<string, string | number>)[effectiveCoin] as string | undefined;
      if (!tokenAddress) {
         console.error('[Transfer] Missing token address for', effectiveCoin, 'on', ALLOWED_CHAIN_DISPLAY_NAME);
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.TRANSACTION_FAILED));
         return null;
      }

      try {
         // USDC uses 6 decimals
         const decimals = 6;
         const amounts = parseUnits(amount, decimals);

         // Time-box the signature request. Without this, a request sent to a wallet that
         // never responds (asleep phone over WalletConnect, stale connection with no live
         // provider here) leaves this promise pending forever — the exact hang that stranded
         // a lender on the "Approve in your wallet" spinner. On timeout we classify it as
         // WALLET_UNREACHABLE and tell them what to do instead of spinning indefinitely.
         const send = writeContractAsync({
            address: tokenAddress as unknown as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [recipient, amounts]
         });
         try {
            return await withTimeout(send, WALLET_RESPONSE_TIMEOUT_MS);
         } catch (timeoutErr) {
            if (timeoutErr instanceof WalletTimeoutError && onLateHash) {
               // The request is still open in the wallet: if it's approved later, record it.
               send.then((lateHash) => onLateHash(lateHash)).catch(() => undefined);
            }
            throw timeoutErr;
         }
      } catch (err) {
         // A stale cached build can fail to import a renamed chunk mid-send; reload to the current
         // build instead of surfacing a bogus "Transaction Error" (see staleChunkReload.ts).
         if (isStaleChunkError(err instanceof Error ? err.message : err)) {
            reloadOnceForStaleChunk();
            return null;
         }
         console.error('Tx failed:', err);
         toastTransferFailure(classifyTransferError(err));
         return null;
      }
   };

   /**
    * Unified USDC send. Picks Base Pay (one popup, Base-Account-only, cold-start capable) or
    * the wagmi transfer above, and normalizes both to a {@link PaymentOutcome} | null. Like
    * `Transfer`, it self-toasts on failure and returns null so callers keep their `if (result)`
    * shape.
    *
    * `onSubmitted` fires on the Base Pay path the instant the popup is approved and the payment
    * id (userOp hash) is known — before on-chain confirmation. Surfaces use it to (a) flip the
    * "Sending → Confirming" overlay copy while the poll runs, and (b) register the payment for
    * reconciliation, so an approved-but-unconfirmed payment (a `timeout`, or a closed tab) still
    * gets its DB write finished later instead of silently stranding the money.
    *
    * A Base Pay `timeout` therefore returns null WITHOUT a failure toast: the money may still
    * settle and the reconciler owns finishing it. All other failures toast and return null.
    */
   const payUsdc = async ({
      method,
      to,
      usdAmount,
      loanId,
      coin = 'USDC',
      dataSuffix,
      onSubmitted,
      onLateWalletHash
   }: {
      method: PaymentMethod;
      to: string;
      usdAmount: string;
      loanId: string;
      coin?: string;
      dataSuffix?: `0x${string}`;
      onSubmitted?: (id: string) => void;
      /** Wallet path only: the wallet answered after the 60s timeout. Register it so it still records. */
      onLateWalletHash?: (hash: string) => void;
   }): Promise<PaymentOutcome | null> => {
      if (method === 'base') {
         let submittedId: string | null = null;
         try {
            const { id } = await startBasePayment({ to, usdAmount, dataSuffix });
            submittedId = id;
            onSubmitted?.(id);
            const confirmed = await waitForBasePayment(id);
            return { hash: confirmed.id, payer: confirmed.sender };
         } catch (err) {
            // Stale-build chunk failure → reload to the current build rather than a false error.
            if (isStaleChunkError(err instanceof Error ? err.message : err)) {
               reloadOnceForStaleChunk();
               return null;
            }
            const paymentError = err instanceof BasePaymentError ? err : null;
            // Once startBasePayment resolved, onSubmitted armed the reconciler and the userOp is in
            // flight. A `timeout` (not confirmed in our window) or an `unknown` (pay() threw a
            // message we can't classify) does NOT prove the money stayed put — the reconciler owns
            // finishing it, so surface a soft "still confirming" instead of a hard error. Only a
            // confirmed revert (`failed`), `insufficient`, or user `rejected` is a real stop.
            const isRecoverable = paymentError?.kind === 'timeout' || paymentError?.kind === 'unknown';
            if (submittedId && isRecoverable) {
               showToast(
                  TOAST_TYPES.INFO,
                  'Still confirming',
                  'Your payment was sent and is taking a moment to confirm. This will update automatically.'
               );
               return null;
            }
            toastTransferFailure(paymentError?.errorCode ?? ERROR_CODES.TRANSACTION_FAILED);
            return null;
         }
      }

      if (method === 'openfort') {
         // Sponsored, gasless send from the embedded smart account. The wallet self-provisions
         // (recovers) on demand, so this works even on a fresh page load with no prior tap.
         try {
            const hash = await sendUsdcFromEmbeddedWallet({ to, usdAmount });
            return { hash };
         } catch (err) {
            // The embedded-wallet send code is lazily imported; a stale cached build can 404 that
            // chunk and throw here. Reload to the current build instead of a false "Transaction
            // Error" — this is the failure that stranded instant-wallet borrowers on withdrawal.
            if (isStaleChunkError(err instanceof Error ? err.message : err)) {
               reloadOnceForStaleChunk();
               return null;
            }
            console.error('[payUsdc:openfort] send failed', err);
            reportInstantWalletFailure('send', err);
            // The signer is still gone after an automatic reset (embeddedWallet.ts). Retrying in
            // this tab can't fix it, so say what does instead of the generic "Try again?".
            if (err instanceof InstantWalletReconnectError) {
               showToast(
                  TOAST_TYPES.ERROR,
                  'Your Instant Wallet needs to reconnect',
                  'Nothing was sent. Sign out and sign back in, or open Moodeng in another browser like Chrome, then try again.',
                  'Get help',
                  'open_support_chat',
                  { supportTopic: INSTANT_WALLET_SUPPORT_TOPIC }
               );
               return null;
            }
            // A server-side wallet hold: its message already says what to do.
            if (err instanceof WalletGateError) {
               showToast(TOAST_TYPES.ERROR, "Your payment didn't go through", err.message);
               return null;
            }
            toastTransferFailure(classifyTransferError(err), INSTANT_WALLET_SUPPORT_TOPIC);
            return null;
         }
      }

      const hash = await Transfer(to, usdAmount, loanId, coin, onLateWalletHash);
      return hash ? { hash } : null;
   };

   return { Transfer, payUsdc };
};

export default useWallet;
