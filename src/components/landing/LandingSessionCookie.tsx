import { useEffect } from 'react';

import { useSelector } from 'react-redux';

import { usePreKycGate } from '@/hooks/usePreKycGate';
import { setLandingSessionCookie } from '@/lib/landingSessionCookie';
import { isGuestEmail } from '@/lib/phoneAuth';
import { getJourney } from '@/lib/verificationJourney';
import type { RootState } from '@/store/store';

/** Keeps the static home page's signed-in buttons right (src/lib/landingSessionCookie.ts). */
export function LandingSessionCookie() {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isSigningOut = useSelector((state: RootState) => Boolean(state.auth.isSigningOut));
   const gate = usePreKycGate();
   const signedIn = Boolean(user?.id && username) && !isSigningOut;

   useEffect(() => {
      if (!signedIn || gate.isLoading) return;
      const midFlow =
         !user.userRole || isGuestEmail(user.email) || (user.userRole === 'borrower' && getJourney(user, gate.isGated).stage !== 'verified');
      setLandingSessionCookie(midFlow ? 'continue' : 'signout', user.userRole);
   }, [signedIn, gate.isLoading, gate.isGated, user]);

   return null;
}
