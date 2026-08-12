import { useSelector } from 'react-redux';
import { BaseError, ChainMismatchError, InsufficientFundsError, parseUnits, UserRejectedRequestError } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { ALLOWED_CHAIN_DISPLAY_NAME, getAllowedChainTokenConfig } from '@/config/wagmiConfig';
import { BasePaymentError, startBasePayment, waitForBasePayment } from '@/lib/basePay';
import { OPENFORT_WALLET_PROVIDER, sendUsdcFromEmbeddedWallet } from '@/lib/web3/openfort';
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

// Inspects the (often deeply-wrapped) wagmi/viem error to route to a toast the
// user can act on, instead of a generic "transaction failed" they can't self-correct.
const classifyTransferError = (err: unknown): ErrorCode => {
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

   const Transfer = async (recipient: string, amount: string, id: string, coin: string = 'USDC'): Promise<string | null> => {
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

         const hash = await writeContractAsync({
            address: tokenAddress as unknown as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [recipient, amounts]
         });

         return hash;
      } catch (err) {
         console.error('Tx failed:', err);
         showToastByConfig(getToastKeyFromErrorCode(classifyTransferError(err)));
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
      onSubmitted
   }: {
      method: PaymentMethod;
      to: string;
      usdAmount: string;
      loanId: string;
      coin?: string;
      dataSuffix?: `0x${string}`;
      onSubmitted?: (id: string) => void;
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
            showToastByConfig(getToastKeyFromErrorCode(paymentError?.errorCode ?? ERROR_CODES.TRANSACTION_FAILED));
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
            console.error('[payUsdc:openfort] send failed', err);
            showToastByConfig(getToastKeyFromErrorCode(classifyTransferError(err)));
            return null;
         }
      }

      const hash = await Transfer(to, usdAmount, loanId, coin);
      return hash ? { hash } : null;
   };

   return { Transfer, payUsdc };
};

export default useWallet;
