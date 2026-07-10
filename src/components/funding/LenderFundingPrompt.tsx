import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import type { RootState } from '@/store/store';
import LenderFundLoanModal from '@/views/lender/loanNote/LenderFundLoanModal';
import { clearPendingFundLoanId, getPendingFundLoanId } from '@/views/lender/loanNote/fundingPopup';

// Routes where the popup must NOT appear: the auth/onboarding chain (the lender is still
// signing up / picking a role / connecting a wallet) and the loan page itself (which
// handles the purchase inline).
const SUPPRESSED_PATH = /^\/(sign-in|sign-up|onboarding|role-selection|auth|lend|help)\b/;

/**
 * Global, mounted once at the app root. Opens the funding popup for a link-arriving lender
 * — but only once they're FULLY onboarded: authenticated, wallet connected, and landed on
 * a normal app screen (not mid sign-up/role/wallet onboarding, and not on the loan page
 * which buys inline). This guarantees the wallet exists before they can fund. Isolated and
 * easy to revert.
 */
export function LenderFundingPrompt() {
   const userId = useSelector((state: RootState) => state.auth.user?.id);
   const username = useSelector((state: RootState) => state.auth.username);
   const walletAddress = useSelector((state: RootState) => state.auth.user?.walletAddress);
   const location = useLocation();

   const isAuthenticated = Boolean(userId && username);
   const onboarded = isAuthenticated && Boolean(walletAddress) && !SUPPRESSED_PATH.test(location.pathname);

   const [loanId, setLoanId] = useState<string | null>(null);

   useEffect(() => {
      if (!onboarded) return;
      const pending = getPendingFundLoanId();
      if (pending) setLoanId(pending);
   }, [onboarded]);

   if (!loanId) return null;

   const close = () => {
      clearPendingFundLoanId();
      setLoanId(null);
   };

   return <LenderFundLoanModal loanId={loanId} onClose={close} />;
}
