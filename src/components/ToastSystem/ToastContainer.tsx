'use client';

import { type FC } from 'react';

import { useRouter } from 'next/navigation';

import { handleToastAction } from '@/components/ToastSystem/config/utils';
import { useToastContext } from '@/components/ToastSystem/hooks/useToastContext';
import Toast from '@/components/ToastSystem/Toast';
import { type ToastData, type ToastPropsType, type ToastType } from '@/components/ToastSystem/types';

const ToastContainer: FC = () => {
   const { toasts, removeToast } = useToastContext();
   const router = useRouter();

   const onToastAction = (action: string, customData?: ToastData) => {
      handleToastAction(action, customData || {}, router);
   };

   if (toasts.length === 0) {
      return null;
   }

   return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
         <div className="space-y-2">
            {toasts.map((toast: ToastPropsType) => (
               <Toast
                  key={toast.id}
                  id={toast.id}
                  toastType={toast.toastType as ToastType}
                  title={toast.title}
                  message={typeof toast.message === 'function' ? toast.message('') : toast.message}
                  buttonText={toast.buttonText}
                  buttonAction={toast.buttonAction}
                  emoji={toast.emoji}
                  customIcon={toast.customIcon}
                  customData={toast.customData}
                  duration={toast.duration}
                  autoClose={toast.autoClose}
                  onClose={removeToast}
                  onAction={onToastAction}
               />
            ))}
         </div>
      </div>
   );
};

export default ToastContainer;
