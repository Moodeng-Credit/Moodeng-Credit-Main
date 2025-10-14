'use client';

import { useEffect } from 'react';

import { useApiToast } from '@/lib/apiHandler';

export const ToastInitializer = () => {
   const toast = useApiToast();

   useEffect(() => {
      // Toast instance is automatically set in useApiToast hook
      // This component just ensures the hook is called to initialize the singleton
      console.log('Toast initialized:', !!toast);
   }, [toast]);

   return null;
};
