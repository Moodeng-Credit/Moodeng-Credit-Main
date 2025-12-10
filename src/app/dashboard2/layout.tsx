'use client';

import type { ReactNode } from 'react';

import { AppContextProvider } from '@/context/AppContext';

export default function Layout({ children }: { children: ReactNode }) {
   return <AppContextProvider>{children}</AppContextProvider>;
}
