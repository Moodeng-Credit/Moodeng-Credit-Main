import { type ReactNode, useEffect } from 'react';

import { darkTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { WagmiProvider } from 'wagmi';

import { AuthInitializer } from '@/components/AuthInitializer';
import BasePaymentReconciler from '@/components/BasePaymentReconciler';
import Loading from '@/components/Loading';
import MechaLauncher from '@/components/mecha/MechaLauncher';
import CrispChat from '@/components/support/CrispChat';
import { SupportContactsModalHost } from '@/components/support/SupportContactsModal';
import { ThemeModeProvider } from '@/components/ThemeModeProvider';
import { ToastProvider } from '@/components/ToastSystem/contexts/ToastContext';
import ToastContainer from '@/components/ToastSystem/ToastContainer';
import { ToastInitializer } from '@/components/ToastSystem/ToastInitializer';
import { WalletSyncInitializer } from '@/components/WalletSyncInitializer';

import { ALLOWED_CHAIN_ID } from '@/config/wagmiConfig';
import { setStoreRef } from '@/lib/axios';
import { config } from '@/lib/config/wagmi';
import { OpenfortProvider } from '@/lib/web3/openfort';
import { persistor, store } from '@/store/store';

const queryClient = new QueryClient();

function WalletConnectionLogger() {
   return null;
}

function StoreInitializer() {
   useEffect(() => {
      setStoreRef(store);
   }, []);
   return null;
}

export function Providers({ children }: { children: ReactNode }) {
   useEffect(() => {
      const handleGlobalError = (e: ErrorEvent) => {
         console.error('[Global Error Log]', e.error || e.message);
      };

      const handleGlobalRejection = (e: PromiseRejectionEvent) => {
         console.error('[Global Promise Rejection]', e.reason);
      };

      window.addEventListener('error', handleGlobalError);
      window.addEventListener('unhandledrejection', handleGlobalRejection);

      return () => {
         window.removeEventListener('error', handleGlobalError);
         window.removeEventListener('unhandledrejection', handleGlobalRejection);
      };
   }, []);

   return (
      <Provider store={store}>
         <PersistGate loading={<Loading />} persistor={persistor}>
            <StoreInitializer />
            <WagmiProvider config={config} reconnectOnMount={false}>
               <QueryClientProvider client={queryClient}>
                  <RainbowKitProvider theme={darkTheme()} initialChain={ALLOWED_CHAIN_ID}>
                     <WalletConnectionLogger />
                     <ToastProvider>
                        <ThemeModeProvider>
                           {/* Openfort embedded-wallet rail (PH escape hatch). Additive and inert
                               unless configured; never touches the wagmi/Base stack above. */}
                           <OpenfortProvider>
                              <AuthInitializer />
                              <ToastInitializer />
                              <WalletSyncInitializer />
                              <BasePaymentReconciler />
                              {children}
                              <SupportContactsModalHost />
                              {/* Crisp owns the persistent help launcher and every "I have a
                                  problem" path — it reaches a human. Mecha stays mounted purely
                                  as the on-demand writing assistant (loan-reason wording), opened
                                  explicitly via openMecha(); it no longer shows a bubble of its
                                  own, so there is exactly one floating launcher on screen. */}
                              <CrispChat />
                              <MechaLauncher />
                              <ToastContainer />
                           </OpenfortProvider>
                        </ThemeModeProvider>
                     </ToastProvider>
                  </RainbowKitProvider>
               </QueryClientProvider>
            </WagmiProvider>
         </PersistGate>
      </Provider>
   );
}
