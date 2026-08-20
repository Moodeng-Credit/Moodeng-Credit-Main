import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import Loading from '@/components/Loading';
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from '@/lib/supabase/client';
import type { RootState } from '@/store/store';

interface ProtectedRouteProps {
   children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
   const user = useSelector((state: RootState) => state.auth.user);
   const username = useSelector((state: RootState) => state.auth.username);
   const isLoading = useSelector((state: RootState) => state.auth.isLoading);
   const isAuthChecked = useSelector((state: RootState) => state.auth.isAuthChecked);
   const location = useLocation();
   const isAuthenticated = !!(username && user?.id);

   // Optional per-user 2FA: someone with an enrolled TOTP factor must clear an MFA
   // challenge once per session before reaching any protected screen. A user with no
   // factor sees nextLevel stay at 'aal1' and passes straight through, unchanged — this
   // is what keeps 2FA opt-in rather than forced on everyone. Passkeys never trigger this:
   // they are a sign-in credential (aal1), not an MFA factor — see usePasskeys.ts.
   const [needsMfaChallenge, setNeedsMfaChallenge] = useState(false);
   const [isMfaChecked, setIsMfaChecked] = useState(false);

   useEffect(() => {
      if (!isAuthenticated || !isSupabaseBrowserConfigured()) {
         setNeedsMfaChallenge(false);
         setIsMfaChecked(true);
         return;
      }

      let cancelled = false;
      getSupabaseBrowserClient()
         .auth.mfa.getAuthenticatorAssuranceLevel()
         .then(({ data, error }) => {
            if (cancelled) return;
            setNeedsMfaChallenge(!error && data?.currentLevel === 'aal1' && data?.nextLevel === 'aal2');
            setIsMfaChecked(true);
         });

      return () => {
         cancelled = true;
      };
   }, [isAuthenticated, user?.id]);

   if ((!isAuthChecked || isLoading) && !isAuthenticated) {
      return <Loading />;
   }

   if (!isAuthenticated) {
      return <Navigate to="/sign-in" state={{ from: location }} replace />;
   }

   if (!isMfaChecked) {
      return <Loading />;
   }

   if (needsMfaChallenge && location.pathname !== '/mfa-challenge') {
      return <Navigate to="/mfa-challenge" state={{ from: location }} replace />;
   }

   if ((user.accountStatus === 'blocked' || user.accountStatus === 'banned') && location.pathname !== '/account-restricted') {
      return <Navigate to="/account-restricted" replace />;
   }

   return <>{children}</>;
}
