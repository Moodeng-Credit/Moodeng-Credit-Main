'use client';

import { useContext } from 'react';

import ToastContext from '@/components/ToastSystem/contexts/ToastContext';

export const useToastContext = () => {
   const context = useContext(ToastContext);
   if (!context) {
      throw new Error('useToastContext must be used within a ToastProvider');
   }
   return context;
};
