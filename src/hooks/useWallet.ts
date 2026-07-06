

import { BaseError, ChainMismatchError, InsufficientFundsError, parseUnits, UserRejectedRequestError } from 'viem';
import { useWriteContract } from 'wagmi';

import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { ALLOWED_CHAIN_DISPLAY_NAME, getAllowedChainTokenConfig } from '@/config/wagmiConfig';
import { BasePaymentError, sendUsdcViaBasePay } from '@/lib/basePay';
import { ERROR_CODES, type ErrorCode } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';

/** How the USDC leaves the payer's hands: Base Account's one-popup pay, or a wagmi wallet transfer. */
export type PaymentMethod = 'base' | 'wallet';

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

const useWallet = () => {
   const { writeContractAsync } = useWriteContract();
   const { showToastByConfig } = useToast();

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
    * shape. A Base Pay `timeout` (approved but unconfirmed in time) also returns null today —
    * the money may still settle, so that case wants reconciliation, tracked for the surface
    * migration rather than marking the loan paid on an unconfirmed userOp.
    */
   const payUsdc = async ({
      method,
      to,
      usdAmount,
      loanId,
      coin = 'USDC',
      dataSuffix
   }: {
      method: PaymentMethod;
      to: string;
      usdAmount: string;
      loanId: string;
      coin?: string;
      dataSuffix?: `0x${string}`;
   }): Promise<PaymentOutcome | null> => {
      if (method === 'base') {
         try {
            const confirmed = await sendUsdcViaBasePay({ to, usdAmount, dataSuffix });
            return { hash: confirmed.id, payer: confirmed.sender };
         } catch (err) {
            const paymentError = err instanceof BasePaymentError ? err : null;
            showToastByConfig(getToastKeyFromErrorCode(paymentError?.errorCode ?? ERROR_CODES.TRANSACTION_FAILED));
            return null;
         }
      }

      const hash = await Transfer(to, usdAmount, loanId, coin);
      return hash ? { hash } : null;
   };

   return { Transfer, payUsdc };
};

export default useWallet;
