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

/** Journey v2 (supabase/migrations/20261117200000_journey_v2.sql): proof of income + 3 videos first. */
export type JourneyV2 = {
   applies: boolean;
   income?: 'none' | 'checking' | 'resend' | 'hold' | 'pass' | 'declined';
   videos?: Array<{ id: string; title: string; tall?: boolean }>;
   videos_watched?: number;
   done?: boolean;
};

export const JOURNEY_V2_PATH = '/onboarding/verify';

/** Fails open like the gate: an error reads as "v2 doesn't apply". */
export const fetchJourneyV2 = async (): Promise<JourneyV2> => {
   const { data, error } = await getSupabaseBrowserClient().rpc('my_journey_v2');
   if (error || !data || typeof data !== 'object') return { applies: false };
   return data as JourneyV2;
};

/** Still has journey v2 steps to do (only ever true while the pre-KYC gate holds them). */
export const needsJourneyV2 = (v2: JourneyV2 | null | undefined) => Boolean(v2?.applies && !v2.done);

export function usePreKycGate(): { isGated: boolean; isLoading: boolean; v2: JourneyV2 | null } {
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
      // Face already on another account: blocked regardless — no call slot for them.
      uiState === 'duplicate' ||
      user.loanAccessStatus === 'approved' ||
      user.userRole === 'lender';
   const { data, isLoading } = useQuery({
      // Keyed on what can change the answer, so an approval or a verification refetches it.
      queryKey: ['pre-kyc-gate', user?.id, user?.loanAccessStatus],
      queryFn: fetchPreKycGate,
      enabled: !cleared,
      staleTime: 30_000
   });
   const isGated = !cleared && data === true;
   const v2Query = useQuery({
      queryKey: ['journey-v2', user?.id, user?.loanAccessStatus],
      queryFn: fetchJourneyV2,
      enabled: isGated,
      staleTime: 15_000
   });
   if (cleared) return { isGated: false, isLoading: false, v2: null };
   return { isGated, isLoading: isLoading || (isGated && v2Query.isLoading), v2: isGated ? (v2Query.data ?? null) : null };
}
