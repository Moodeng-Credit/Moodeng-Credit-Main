'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { TOAST_CONFIGS } from '@/components/ToastSystem/config/toastConfig';
import type { ToastData } from '@/components/ToastSystem/types';

export const handleToastAction = (action: string, customData: ToastData, router: AppRouterInstance) => {
   const configEntry = Object.values(TOAST_CONFIGS).find((config) => config.buttonAction === action);

   if (configEntry && 'route' in configEntry && configEntry.route && router) {
      router.push(configEntry.route);
      return;
   }

   if (configEntry && 'externalAction' in configEntry && configEntry.externalAction && typeof configEntry.externalAction === 'string') {
      window.open(configEntry.externalAction, '_blank');
      return;
   }

   if (action.startsWith('retry_') && customData?.retry) {
      customData.retry();
      return;
   }

   console.log('Toast action:', action, customData);
};
