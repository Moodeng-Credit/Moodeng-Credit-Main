import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';

import type { RootState } from '@/store/store';
import LenderFundLoanModal from '@/views/lender/loanNote/LenderFundLoanModal';
import { PENDING_FUND_LOAN_KEY } from '@/views/lender/loanNote/fundingPopup';

/**
 * Global, mounted once at the app root. After a lender authenticates, if a loanId was
 * stashed (because they clicked "Support" on a loan link while logged out), this opens
 * the funding popup for that borrower — so they fund directly instead of being dropped on
 * the request board. Renders nothing otherwise. Isolated and easy to revert.
 */
export function LenderFundingPrompt() {
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthenticated = Boolean(userId && username);
   const [loanId, setLoanId] = useState<string | null>(null);

   useEffect(() => {
      if (!isAuthenticated) return;
      try {
         const pending = window.sessionStorage.getItem(PENDING_FUND_LOAN_KEY);
         if (pending) setLoanId(pending);
      } catch {
         /* ignore storage errors */
      }
   }, [isAuthenticated]);

   if (!loanId) return null;

   const close = () => {
      try {
         window.sessionStorage.removeItem(PENDING_FUND_LOAN_KEY);
      } catch {
         /* ignore */
      }
      setLoanId(null);
   };

   return <LenderFundLoanModal loanId={loanId} onClose={close} />;
}
