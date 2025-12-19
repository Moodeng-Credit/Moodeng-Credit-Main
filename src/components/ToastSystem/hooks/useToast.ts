

import { useCallback } from 'react';

import {
   type ShowToast,
   type Toast,
   TOAST_CONFIGS,
   TOAST_SETTINGS,
   TOAST_TYPES,
   type ToastConfigKey,
   type ToastData,
   type ToastOverrides
} from '@/components/ToastSystem/config/toastConfig';
import { useToastContext } from '@/components/ToastSystem/hooks/useToastContext';

export const useToast = () => {
   const { addToast, removeToast, clearAllToasts } = useToastContext();

   const showToast: ShowToast = useCallback(
      (toastType, title, message, buttonText, buttonAction, customData, customIcon) => {
         const toast: Omit<Toast, 'id'> = {
            toastType: toastType || TOAST_TYPES.INFO,
            title,
            message,
            buttonText,
            buttonAction,
            customData,
            customIcon,
            duration: TOAST_SETTINGS.DEFAULT_DURATION,
            autoClose: true
         };

         addToast(toast);
      },
      [addToast]
   );

   const showToastByConfig = useCallback(
      (configKey: ToastConfigKey, customData: ToastData = {}, overrides: ToastOverrides = {}) => {
         const config = TOAST_CONFIGS[configKey];
         if (!config) {
            console.error(`Toast config '${configKey}' not found`);
            return;
         }

         const message =
            typeof config.message === 'function' ? config.message((customData?.points ?? customData?.error ?? 0) as never) : config.message;

         const toast: Omit<Toast, 'id'> = {
            toastType: config.toastType,
            title: config.title,
            message,
            buttonText: config.buttonText,
            buttonAction: config.buttonAction,
            customIcon: config.customIcon,
            customData,
            duration: TOAST_SETTINGS.DEFAULT_DURATION,
            autoClose: true,
            ...overrides
         };

         addToast(toast);
      },
      [addToast]
   );

   return {
      showToastByConfig,
      showToast,
      removeToast,
      clearAllToasts
   };
};

export default useToast;
