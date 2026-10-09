import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';

import { isUserVerified } from '@/lib/isUserVerified';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getVerificationUiState } from '@/lib/verificationUiState';
import type { RootState } from '@/store/store';

/**
 * Pre-KYC gate (supabase/migrations/20261009120000_pre_kyc_gate.sql): a new borrower connects
 * Messenger, books the intro call and is approved after it (loan_access_status = 'approved')
 * before they can start ID verification. The rule lives in SQL (needs_pre_kyc_gate) so the app,
 * create-didit-session and loan-access all agree; admins switch it with /kycgate on|off.
 *
 * Where a gated borrower goes instead of KYC.
 */
export const PRE_KYC_CONNECT_PATH = '/onboarding/connect';

/**
 * Fails open: an error (RPC not deployed yet, network) reads as "not gated". create-didit-session
 * enforces the real rule and answers APPROVAL_REQUIRED, which /verify routes here too.
 */
export const fetchPreKycGate = async (): Promise<boolean> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('my_pre_kyc_gate');
   if (error) return false;
   return data === true;
};

export function usePreKycGate(): { isGated: boolean; isLoading: boolean } {
   const user = useSelector((state: RootState) => state.auth.user);
   // Verified or approved users are never gated — no round trip needed. Nor is anyone whose ID is
   // already with Didit (in review / processing): that check is paid for, so there's nothing to save
   // by sending them to book a call first.
   const uiState = getVerificationUiState(user);
   const cleared =
      !user ||
      isUserVerified(user) ||
      uiState === 'review' ||
      uiState === 'processing' ||
      user.loanAccessStatus === 'approved' ||
      user.userRole === 'lender';
   const { data, isLoading } = useQuery({
      // Keyed on what can change the answer, so an approval or a verification refetches it.
      queryKey: ['pre-kyc-gate', user?.id, user?.loanAccessStatus],
      queryFn: fetchPreKycGate,
      enabled: !cleared,
      staleTime: 30_000
   });
   if (cleared) return { isGated: false, isLoading: false };
   return { isGated: data === true, isLoading };
}
