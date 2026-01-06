

import { type ReactNode, useEffect } from 'react';

import { darkTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { WagmiProvider } from 'wagmi';

import { ToastProvider } from '@/components/ToastSystem/contexts/ToastContext';
import ToastContainer from '@/components/ToastSystem/ToastContainer';
import { ToastInitializer } from '@/components/ToastSystem/ToastInitializer';
import { WalletSyncInitializer } from '@/components/WalletSyncInitializer';
import { AuthInitializer } from '@/components/AuthInitializer';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import { setStoreRef } from '@/lib/axios';
import { config } from '@/lib/config/wagmi';
import { persistor, store } from '@/store/store';

const queryClient = new QueryClient();

function StoreInitializer() {
   useEffect(() => {
      setStoreRef(store);
   }, []);
   return null;
}

export function Providers({ children }: { children: ReactNode }) {
   useEffect(() => {
      const handleGlobalClick = (e: MouseEvent) => {
         const target = e.target as HTMLElement;
         // Find the closest button or clickable element to get better context
         const clickable = target.closest('button, a, [role="button"]');
         const text = target.innerText || clickable?.textContent || '';
         
         console.log('[Click Log]', {
            tagName: target.tagName,
            text: text.trim().slice(0, 100),
            className: target.className,
            isBaseAccount: text.includes('Base Account')
         });

         if (text.includes('Base Account')) {
            console.log('!!! Base Account button detected in click !!!');
         }
      };

      const handleGlobalError = (e: ErrorEvent) => {
         console.error('[Global Error Log]', e.error || e.message);
      };

      const handleGlobalRejection = (e: PromiseRejectionEvent) => {
         console.error('[Global Promise Rejection]', e.reason);
      };

      window.addEventListener('click', handleGlobalClick, true);
      window.addEventListener('error', handleGlobalError);
      window.addEventListener('unhandledrejection', handleGlobalRejection);

      return () => {
         window.removeEventListener('click', handleGlobalClick, true);
         window.removeEventListener('error', handleGlobalError);
         window.removeEventListener('unhandledrejection', handleGlobalRejection);
      };
   }, []);

   return (
      <Provider store={store}>
         <PersistGate loading={null} persistor={persistor}>
            <StoreInitializer />
            <WagmiProvider config={config}>
               <QueryClientProvider client={queryClient}>
                  <RainbowKitProvider theme={darkTheme()} initialChain={ALLOWED_CHAIN_ID}>
                     <ToastProvider>
                        <AuthInitializer />
                        <ToastInitializer />
                        <WalletSyncInitializer />
                        {children}
                        <ToastContainer />
                     </ToastProvider>
                  </RainbowKitProvider>
               </QueryClientProvider>
            </WagmiProvider>
         </PersistGate>
      </Provider>
   );
}
