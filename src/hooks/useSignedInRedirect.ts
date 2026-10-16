import { useEffect, useState } from 'react';

import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { PRE_KYC_CONNECT_PATH, usePreKycGate } from '@/hooks/usePreKycGate';
import { getPostSignInPath } from '@/lib/postSignInPath';
import { getJourney } from '@/lib/verificationJourney';
import type { RootState } from '@/store/store';
import type { User } from '@/types/authTypes';

/** Where someone already signed in goes instead of the sign-in / sign-up form. */
export const getSignedInReturnPath = async (user: User, isGated: boolean): Promise<string> => {
   if (!user.userRole) return '/onboarding/role';
   if (user.userRole === 'borrower') {
      const journey = getJourney(user, isGated);
      if (journey.onboarding && journey.action === 'wallet') return '/onboarding/wallet';
      if (journey.onboarding && journey.action === 'connect') return PRE_KYC_CONNECT_PATH;
   }
   return getPostSignInPath(user);
};

/**
 * /sign-in and /sign-up for someone who is already signed in: take them to their next step.
 * Facebook's browser reloads pages it killed, and the static landing page only links to /sign-in,
 * so a guest mid-onboarding came back to an email form and signed their own guest account out.
 *
 * Decided once, when the page's auth check settles: signing in or up on this page (which also
 * fills in the user) never triggers it, nor does arriving here mid sign-out.
 * Returns true while it is sending them on (render nothing meanwhile).
 */
export function useSignedInRedirect(): boolean {
   const navigate = useNavigate();
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const isLoading = useSelector((state: RootState) => state.auth.isLoading);
   const isSigningOut = useSelector((state: RootState) => Boolean(state.auth.isSigningOut));
   const signedIn = Boolean(user?.id && username) && !isSigningOut;
   const gate = usePreKycGate();

   const [arrivedSignedIn, setArrivedSignedIn] = useState<boolean | null>(null);
   const settled = isAuthChecked && !isLoading;
   useEffect(() => {
      if (arrivedSignedIn === null && settled) setArrivedSignedIn(signedIn);
   }, [arrivedSignedIn, settled, signedIn]);

   const redirecting = arrivedSignedIn === true && signedIn;
   useEffect(() => {
      if (!redirecting || gate.isLoading) return;
      let cancelled = false;
      void getSignedInReturnPath(user, gate.isGated)
         .catch(() => '/request-board')
         .then((path) => {
            if (!cancelled) navigate(path, { replace: true });
         });
      return () => {
         cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [redirecting, gate.isLoading, gate.isGated, user?.id, navigate]);

   return redirecting;
}
