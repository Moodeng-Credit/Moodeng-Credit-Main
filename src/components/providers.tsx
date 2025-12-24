

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
   return (
      <Provider store={store}>
         <PersistGate loading={null} persistor={persistor}>
            <StoreInitializer />
            <WagmiProvider config={config}>
               <QueryClientProvider client={queryClient}>
                  <RainbowKitProvider theme={darkTheme()}>
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
