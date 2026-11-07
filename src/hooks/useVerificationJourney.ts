import { useCallback } from 'react';

import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { PRE_KYC_CONNECT_PATH, usePreKycGate } from '@/hooks/usePreKycGate';

import { ID_PATHS } from '@/lib/idTrack';
import { getIdJourney, getJourney, type Journey } from '@/lib/verificationJourney';
import type { RootState } from '@/store/store';
import type { User } from '@/types/authTypes';
import { useIdLang, useIdTrackStatus } from '@/views/indonesia/idFlow';

/**
 * The signed-in borrower's place on the way to their first loan (src/lib/verificationJourney.ts),
 * plus `go()`, which takes them to their next step. `onApply` lets a screen that already has the loan
 * form open handle "apply" itself; otherwise it opens the request board's loan form.
 */
export function useVerificationJourney(
   onApply?: () => void,
   // A screen that's handed the borrower as a prop (the loan form) passes it, so both always agree.
   userOverride?: User | null
): Journey & { isLoading: boolean; go: () => void } {
   const storeUser = useSelector((state: RootState) => state.auth.user);
   const user = userOverride ?? storeUser;
   const navigate = useNavigate();
   const { isGated, isLoading: gateLoading } = usePreKycGate();
   // Indonesia track: until the team approves them, their next step is in /id/onboarding.
   const idTrack = useIdTrackStatus();
   const idLang = useIdLang();
   const idData = idTrack.isIndo ? idTrack.data : undefined;
   const journey = idData && idData.next !== 'apply' ? getIdJourney(idData, idLang) : getJourney(user, isGated);
   const isLoading = gateLoading || idTrack.isLoading;

   const go = useCallback(() => {
      if (journey.action === 'id_onboarding') navigate(ID_PATHS.onboarding);
      else if (journey.action === 'wallet') navigate('/onboarding/wallet');
      else if (journey.action === 'connect') navigate(PRE_KYC_CONNECT_PATH);
      else if (journey.action === 'verify_status') navigate('/verify');
      else if (journey.action === 'apply') {
         if (onApply) onApply();
         else navigate('/request-board', { state: { openLoanRequest: true } });
      }
   }, [journey.action, navigate, onApply]);

   return { ...journey, isLoading, go };
}
