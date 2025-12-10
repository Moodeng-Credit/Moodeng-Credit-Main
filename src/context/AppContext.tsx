import { createContext, useContext } from 'react';
import { useRef } from 'react';

import type { StoreApi } from 'zustand';
import { createStore, useStore } from 'zustand';

type AppStore = {
   theme: string | null;
};

const AppStoreContext = createContext<StoreApi<AppStore> | null>(null);

export function AppContextProvider(props: { children: React.ReactNode }) {
   const storeRef = useRef<StoreApi<AppStore> | null>(null);
   if (storeRef.current === null) {
      storeRef.current = createStore(() => ({
         theme: null
      }));
   }
   return <AppStoreContext.Provider value={storeRef.current}>{props.children}</AppStoreContext.Provider>;
}

// HMR will not working here but that's okay
//eslint-disable-next-line
export function useAppContext<T>(selector: (state: AppStore) => T): T {
   const store = useContext(AppStoreContext);
   if (!store) {
      throw new Error('Missing <AppContextProvider>');
   }
   return useStore(store, selector);
}
