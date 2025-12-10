'use client';

import type { ReactNode } from 'react';

import { AppContextProvider } from '@/context/AppContext';
import { QueryClientContext } from '@/context/QueryClientContext';

export default function Layout({ children }: { children: ReactNode }) {
   return (
      <QueryClientContext>
         <AppContextProvider>{children}</AppContextProvider>
      </QueryClientContext>
   );
}
