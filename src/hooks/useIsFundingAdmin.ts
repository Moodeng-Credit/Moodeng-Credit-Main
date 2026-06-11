import { useSelector } from 'react-redux';
import { useAccount } from 'wagmi';

import { isFundingAdmin } from '@/config/loanFundingConfig';
import type { RootState } from '@/store/store';

/**
 * Returns whether the current user is a Moodeng funding admin (Jon / Emma).
 *
 * Gates on the authenticated account email (the repo's admin model) and, if the
 * optional ADMIN_WALLETS allowlist is configured, additionally on the connected wallet.
 * Used to show/hide the "Fund Loan" button and funding modal. The edge function and the
 * smart contract (ORIGINATOR_ROLE) enforce the real security boundary server/chain-side.
 */
export function useIsFundingAdmin(): boolean {
   const email = useSelector((state: RootState) => state.auth.user?.email);
   const { address } = useAccount();
   return isFundingAdmin({ email, walletAddress: address });
}
