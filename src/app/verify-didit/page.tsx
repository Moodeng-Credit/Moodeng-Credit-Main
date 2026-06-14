import { useEffect } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Legacy entry point. The Traditional KYC flow now runs through the shared /verify
 * orchestrator (liveness check first, then ID + face match). This redirects any old
 * link or stale Didit callback into that flow with the Didit method preselected.
 */
export default function DiditVerification() {
   const navigate = useNavigate();
   const location = useLocation();

   useEffect(() => {
      const returnTo =
         (location.state as { returnTo?: string } | null)?.returnTo ||
         new URLSearchParams(location.search).get('returnTo') ||
         undefined;
      navigate('/verify', { replace: true, state: { method: 'didit', returnTo } });
   }, [location, navigate]);

   return null;
}
