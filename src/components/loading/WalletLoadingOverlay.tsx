import { useAccount } from 'wagmi';

export const WalletLoadingOverlay = () => {
   const { status } = useAccount();

   // 'connecting' covers the initial click (Desktop)
   // 'reconnecting' covers the return from a redirect (Mobile)
   if (status === 'connecting' || status === 'reconnecting') {
      return (
         <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-2xl shadow-2xl">
               <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
               <div className="flex flex-col items-center">
                  <p className="text-gray-900 font-semibold text-lg">Connecting Wallet</p>
                  <p className="text-gray-500 text-sm">Please follow instructions in your wallet</p>
               </div>
            </div>
         </div>
      );
   }

   return null;
};
