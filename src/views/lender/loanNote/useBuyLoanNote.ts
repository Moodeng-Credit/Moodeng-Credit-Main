import { useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { BaseError, UserRejectedRequestError } from 'viem';
import { useAccount } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { ensureUsdcAllowance, getLoanManagerService, getUsdcBalance } from '@/lib/web3/loanManager';
import { recordLoanNotePurchase, usdcToBaseUnits } from '@/lib/loanNotes/api';
import type { LoanNotePageData } from '@/lib/loanNotes/types';

export type BuyStep = 'idle' | 'checking' | 'approving' | 'buying' | 'recording';

export interface BuyResult {
   loanNoteId: string;
   purchaseAmount: number;
   expectedRepayment: number;
   dueDate: string;
   iouPoints: number;
   txHash: string;
   /** false if the on-chain purchase succeeded but the DB record didn't (recoverable, not lost). */
   synced: boolean;
}

/** Turns wallet/contract errors into a short, user-actionable message. */
const friendlyError = (err: unknown): { title: string; message: string } => {
   if (err instanceof BaseError && err.walk((e) => e instanceof UserRejectedRequestError)) {
      return { title: 'Cancelled', message: 'You cancelled the transaction in your wallet.' };
   }
   const msg = (err as Error)?.message ?? '';
   if (/insufficient funds/i.test(msg)) return { title: 'Not enough ETH for gas', message: 'You need a little ETH on Base for the network fee.' };
   if (/listing is not active|ListingNotActive/i.test(msg)) return { title: 'No longer available', message: 'This loan was just funded by someone else.' };
   if (/chain|network/i.test(msg)) return { title: 'Wrong network', message: 'Switch your wallet to Base, then try again.' };
   return { title: 'Purchase failed', message: 'Something went wrong before the payment. Nothing was charged — please try again.' };
};

/**
 * Shared "fund the Loan Note" action used by the purchase page and the dashboard popup.
 * Pre-checks USDC balance, approves if needed, buys the Note, then records the purchase +
 * IOU points. Repayments later auto-route to the lender.
 *
 * Safety: once the on-chain purchase confirms, the buyer owns the Note even if the DB
 * recording then fails — in that case we return synced=false (with the tx hash) instead of
 * a scary failure, and retry the record once. The record endpoint is idempotent.
 */
export function useBuyLoanNote() {
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();
   const { showToast } = useToast();
   const [step, setStep] = useState<BuyStep>('idle');

   const busy = step !== 'idle';

   const buy = async (data: LoanNotePageData): Promise<BuyResult | null> => {
      if (!address) {
         openConnectModal?.();
         return null;
      }
      if (!data.onchainLoanId) {
         showToast(TOAST_TYPES.ERROR, 'Unavailable', 'This loan does not have a sellable Loan Note.');
         return null;
      }

      const amountBase = usdcToBaseUnits(data.listingPrice);

      try {
         // 1) Balance pre-check (real mode only; mock returns null).
         setStep('checking');
         const balance = await getUsdcBalance(address);
         if (balance != null && balance < amountBase) {
            showToast(TOAST_TYPES.ERROR, 'Not enough USDC', `You need ${data.listingPrice} USDC in your wallet to fund this loan.`);
            return null;
         }

         // 2) Approve (no-op in mock; sponsored if paymaster on).
         setStep('approving');
         await ensureUsdcAllowance(address, amountBase);

         // 3) Buy on-chain. After this confirms, the purchase is real.
         setStep('buying');
         const { txHash } = await getLoanManagerService().buyLoanNote(data.onchainLoanId);

         // 4) Record + award IOU points. If it fails, the buyer still owns the Note — retry
         //    once, then surface synced=false (recoverable) rather than losing the purchase.
         setStep('recording');
         let iouPoints = data.iouPointsReward;
         let synced = true;
         const record = () =>
            recordLoanNotePurchase({
               loanId: data.loanId,
               txHash,
               buyerWallet: address,
               onchainLoanId: data.onchainLoanId,
               price: data.listingPrice
            });
         try {
            iouPoints = (await record()).iouPointsAwarded || data.iouPointsReward;
         } catch {
            try {
               iouPoints = (await record()).iouPointsAwarded || data.iouPointsReward;
            } catch {
               synced = false;
            }
         }

         return {
            loanNoteId: data.onchainLoanId,
            purchaseAmount: data.listingPrice,
            expectedRepayment: data.expectedRepayment,
            dueDate: data.dueDate,
            iouPoints,
            txHash,
            synced
         };
      } catch (err) {
         const { title, message } = friendlyError(err);
         showToast(TOAST_TYPES.ERROR, title, message);
         return null;
      } finally {
         setStep('idle');
      }
   };

   return { buy, busy, step, hasWallet: Boolean(address) };
}
