import { createContext, useContext } from 'react';
import { useRef } from 'react';

import type { StoreApi } from 'zustand';
import { createStore, useStore } from 'zustand';

type SortOption = 'highest' | 'lowest' | 'newest' | 'oldest';

type RequestBoardFilterStore = {
   amount?: string;
   rate?: string;
   date?: Date | null;
   loanTime?: string;
   network?: string;
   search?: string;
   sortBy?: SortOption;
   // setters
   setSortBy: (sortBy: SortOption) => void;
};

const RequestBoardFilterContext = createContext<StoreApi<RequestBoardFilterStore> | null>(null);

export function RequestBoardFilterContextProvider(props: { children: React.ReactNode }) {
   const storeRef = useRef<StoreApi<RequestBoardFilterStore> | null>(null);
   if (storeRef.current === null) {
      storeRef.current = createStore(
         (set) =>
            ({
               // state
               amount: '',
               rate: '',
               date: null,
               loanTime: '',
               network: '',
               search: '',
               sortBy: undefined,
               // setters
               setSortBy: (sortBy) => set({ sortBy })
            }) satisfies RequestBoardFilterStore
      );
   }
   return <RequestBoardFilterContext.Provider value={storeRef.current}>{props.children}</RequestBoardFilterContext.Provider>;
}

// HMR will not working here but that's okay
//eslint-disable-next-line
export function useRequestBoardFilterContext<T>(selector: (state: RequestBoardFilterStore) => T): T {
   const store = useContext(RequestBoardFilterContext);
   if (!store) {
      throw new Error('Missing <RequestBoardFilterContextProvider>');
   }
   return useStore(store, selector);
}
