import { useState } from 'react';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

import { TOAST_TYPES } from '@/components/ToastSystem/config/toastConfig';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { ensureUsdcAllowance, getLoanManagerService } from '@/lib/web3/loanManager';
import { recordLoanNotePurchase, usdcToBaseUnits } from '@/lib/loanNotes/api';
import type { LoanNotePageData } from '@/lib/loanNotes/types';

export interface BuyResult {
   loanNoteId: string;
   purchaseAmount: number;
   expectedRepayment: number;
   dueDate: string;
   iouPoints: number;
}

/**
 * Shared "fund the Loan Note" action used by both the full purchase page and the
 * dashboard funding popup. Approves USDC if needed, buys the Note (lender reimburses
 * Moodeng), records the purchase + IOU points. Repayments then auto-route to the lender.
 *
 * Assumes the caller is already authenticated; if no wallet is connected it opens the
 * connect modal and returns null.
 */
export function useBuyLoanNote() {
   const { address } = useAccount();
   const { openConnectModal } = useConnectModal();
   const { showToast } = useToast();
   const [busy, setBusy] = useState(false);

   const buy = async (data: LoanNotePageData): Promise<BuyResult | null> => {
      if (!address) {
         openConnectModal?.();
         return null;
      }
      if (!data.onchainLoanId) {
         showToast(TOAST_TYPES.ERROR, 'Unavailable', 'This loan does not have a sellable Loan Note.');
         return null;
      }

      setBusy(true);
      try {
         const service = getLoanManagerService();
         await ensureUsdcAllowance(address, usdcToBaseUnits(data.listingPrice));
         const { txHash } = await service.buyLoanNote(data.onchainLoanId);

         const { iouPointsAwarded } = await recordLoanNotePurchase({
            loanId: data.loanId,
            txHash,
            buyerWallet: address,
            onchainLoanId: data.onchainLoanId,
            price: data.listingPrice
         });

         return {
            loanNoteId: data.onchainLoanId,
            purchaseAmount: data.listingPrice,
            expectedRepayment: data.expectedRepayment,
            dueDate: data.dueDate,
            iouPoints: iouPointsAwarded || data.iouPointsReward
         };
      } catch (err) {
         showToast(TOAST_TYPES.ERROR, 'Purchase failed', (err as Error).message || 'Could not complete the purchase.');
         return null;
      } finally {
         setBusy(false);
      }
   };

   return { buy, busy, hasWallet: Boolean(address) };
}
