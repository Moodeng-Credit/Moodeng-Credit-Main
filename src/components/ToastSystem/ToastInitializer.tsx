'use client';

import { useEffect } from 'react';

import { useApiToast } from '@/lib/apiHandler';

export const ToastInitializer = () => {
   const toast = useApiToast();

   useEffect(() => {
      console.log('Toast initialized:', !!toast);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   return null;
};
