import { useEffect, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';

/**
 * Global overlay that appears during user-initiated wallet connections.
 * Distinguishes between explicit connection attempts and background 
 * auto-reconnections on page load.
 */
export const WalletLoadingOverlay = () => {
   const { status, isReconnecting } = useAccount();
   const { disconnect } = useDisconnect();

   const [showLoader, setShowLoader] = useState(false);

   useEffect(() => {
      // Show loader immediately when connecting but not reconnecting.
      if (status === 'connecting' && !isReconnecting) {
         setShowLoader(true);
      } else {
         setShowLoader(false);
      }
   }, [status, isReconnecting]);

   useEffect(() => {
      console.log('[WalletLoadingOverlay] useAccount State:', {
         status,
         isReconnecting,
         showLoader
      });
   }, [status, isReconnecting, showLoader]);

   return null;
};
