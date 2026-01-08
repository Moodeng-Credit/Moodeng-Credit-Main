import { useEffect, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';

/**
 * Global overlay that appears during user-initiated wallet connections.
 * Uses a status-based delay to filter out short initialization flashes 
 * on page load while still supporting mobile full-page redirects.
 */
export const WalletLoadingOverlay = () => {
   const { status, isReconnecting } = useAccount();
   const { disconnect } = useDisconnect();

   const [showLoader, setShowLoader] = useState(false);

   useEffect(() => {
      let timeout: ReturnType<typeof setTimeout>;

      // Status 'connecting' with !isReconnecting is our target.
      // We add a 500ms delay to ensure it's not just a quick initialization flash 
      // which happens during Wagmi's internal mount check.
      if (status === 'connecting' && !isReconnecting) {
         timeout = setTimeout(() => {
            setShowLoader(true);
         }, 3000);
      } else {
         setShowLoader(false);
      }

      return () => {
         if (timeout) clearTimeout(timeout);
      };
   }, [status, isReconnecting]);

   useEffect(() => {
      console.log('[WalletLoadingOverlay] useAccount State:', {
         status,
         isReconnecting,
         showLoader
      });
   }, [status, isReconnecting, showLoader]);

   if (!showLoader) return null;

   return (
      <div className="fixed inset-0 !z-[2147483647] flex items-center justify-center bg-[#171420]/80 backdrop-blur-md transition-all duration-300 animate-in fade-in">
         <div className="relative flex flex-col items-center gap-6 p-10 rounded-3xl bg-white shadow-2xl transform transition-transform animate-in zoom-in-95 duration-200">
            <div className="relative">
               {/* Outer spinning ring */}
               <div className="h-16 w-16 animate-spin rounded-full border-[6px] border-blue-100 border-t-blue-600" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-3 w-3 bg-blue-600 rounded-full animate-pulse" />
               </div>
            </div>
            <div className="flex flex-col items-center text-center">
               <h2 className="text-gray-900 font-bold text-xl mb-2 italic tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
                  CONNECTING
               </h2>
               <p className="text-gray-500 text-sm max-w-[220px] font-medium leading-relaxed mb-4">
                  Please verify the connection in your wallet app
               </p>
               
               <button
                  onClick={() => disconnect()}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors text-sm"
               >
                  Cancel
               </button>
            </div>
         </div>
      </div>
   );
};
